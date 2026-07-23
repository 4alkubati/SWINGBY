"""
search_index.py — LANE F: "find businesses whose past work resembles this query".

THE PROBLEM
    `GET /businesses/?q=` used to run `ilike(business_name, '%q%')`. Typing
    "big house" returned zero results, forever, because no business is *named*
    "big house". The owner's ask is the opposite of name matching: surface the
    companies that PROBABLY DID THE SAME KIND OF JOB.

THE CORPUS
    Nothing in the schema could answer that, so `business_work_index` was built
    (see docs/business_work_index.sql). Per business it stores:
        work_text    — titles/descriptions/categories of its COMPLETED bookings
        profile_text — its own name, category, description
        corpus       — the two concatenated
        tsv          — weighted tsvector (work at 'A', profile at 'B')
        embedding    — vector(1536), currently NULL everywhere
    A Postgres function ranks against it and returns business ids + scores.

WHICH PATH IS LIVE
    Two ranking paths share one contract (id, match_score, match_reason):

    1. LEXICAL  — `search_businesses_by_work` (weighted tsvector + pg_trgm).
                  **THIS IS THE LIVE PATH.**
    2. SEMANTIC — `search_businesses_semantic` (pgvector cosine distance).
                  Built, indexed, granted — and dormant.

    Semantic is dormant because this deployment has NO embedding-provider key:
    there is no `backend/.env` on the box and `app/config.py` lists no
    embedding credential among its required or optional vars. Rather than block
    the feature, the lexical path ships now and the semantic path sits behind
    `SEMANTIC_SEARCH_ENABLED` — the same idiom as
    `credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED`. Flipping it on is a config
    change plus a backfill, not another migration.

    Tier 3 is the in-process fallback: if the RPC is missing (migration not
    applied on a dev/CI database) the endpoint ranks fetched rows with
    `lexical_rank` below. That is still corpus-aware — strictly better than the
    old name-only ilike — so search degrades instead of breaking.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


# ── Feature flag ─────────────────────────────────────────────────────────────

# Semantic (pgvector) ranking. OFF: no embedding provider is configured on this
# deployment, so every `business_work_index.embedding` is NULL and the semantic
# RPC would return zero rows for every query. Turning this on requires, in
# order: (1) provision a provider and set SEARCH_EMBEDDING_* below, (2) wire
# `embed_texts` to that provider, (3) run `backfill_embeddings()`, (4) set this
# to True. Until then the lexical path answers every query.
SEMANTIC_SEARCH_ENABLED = False

# Provider config, read straight from the environment rather than app.config so
# this module stays self-contained. Promote these into config._OPTIONAL when a
# provider is actually provisioned.
SEARCH_EMBEDDING_API_KEY = os.getenv("SEARCH_EMBEDDING_API_KEY", "")
SEARCH_EMBEDDING_MODEL = os.getenv("SEARCH_EMBEDDING_MODEL", "")

# Must match the column width in docs/business_work_index.sql. Changing it means
# altering the column and re-embedding every row.
EMBEDDING_DIM = 1536

# RPC names (docs/business_work_index.sql).
WORK_SEARCH_RPC = "search_businesses_by_work"
SEMANTIC_SEARCH_RPC = "search_businesses_semantic"

# Ceiling on ranked ids pulled back from the DB before the caller applies its
# own visibility/distance filters and paginates. Generous for a Calgary-sized
# marketplace; keeps one pathological query from dragging the whole table up.
CANDIDATE_CAP = 200


class EmbeddingUnavailable(RuntimeError):
    """Raised when an embedding is requested but no provider is wired up."""


def semantic_search_available() -> bool:
    """True only when the flag is on AND a provider is actually configured."""
    return bool(
        SEMANTIC_SEARCH_ENABLED and SEARCH_EMBEDDING_API_KEY and SEARCH_EMBEDDING_MODEL
    )


# ── Corpus text (mirrors build/refresh logic in the SQL) ─────────────────────


def corpus_from_business(business: dict) -> str:
    """
    Profile-side corpus for one business row: the same fields
    `refresh_business_work_index()` concatenates into `profile_text`.

    Used by the in-process fallback, which only has `businesses` rows to work
    with. Kept in lockstep with the SQL so the fallback ranks the same words the
    database would.
    """
    parts = [
        business.get("business_name"),
        business.get("category"),
        business.get("custom_category"),
        business.get("description"),
    ]
    return " ".join(str(p).strip() for p in parts if p and str(p).strip())


# ── Pure lexical ranker (in-process fallback) ────────────────────────────────

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Words that carry no signal about the KIND of job. Deliberately small — an
# aggressive list would drop domain words ("out" in "move out", "up" in "clean
# up") that genuinely discriminate between job types.
_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "i",
        "in",
        "is",
        "it",
        "me",
        "my",
        "need",
        "of",
        "on",
        "or",
        "that",
        "the",
        "to",
        "was",
        "with",
        "you",
    }
)


def _stem(token: str) -> str:
    """
    Crude suffix strip so "cleaning" / "cleaned" / "cleans" all collapse onto
    "clean". Not a real Porter stemmer — this only has to approximate what
    Postgres' 'english' config does well enough for the fallback path, and a
    dependency-free 20 lines beats pulling in NLTK for a degraded mode.
    """
    for suffix in ("ing", "ers", "ed", "es", "er", "s"):
        if len(token) > len(suffix) + 3 and token.endswith(suffix):
            return token[: -len(suffix)]
    return token


def _tokens(text: str) -> list[str]:
    return [
        _stem(t) for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS
    ]


def lexical_rank(query: str, corpus: str) -> float:
    """
    Score how well `corpus` answers `query`, in [0.0, 1.0]. 0.0 means no match.

    Term COVERAGE, not term frequency: a business whose work text matches three
    of the query's four words beats one that repeats a single word ten times.
    That is the "did a job like this" question — repetition says nothing about
    breadth of fit. A whole-phrase hit adds a bonus so "deep clean" outranks a
    corpus that merely mentions "deep" and "clean" in unrelated places.
    """
    q_tokens = _tokens(query)
    if not q_tokens:
        return 0.0

    c_tokens = set(_tokens(corpus))
    if not c_tokens:
        return 0.0

    matched = 0
    for q in q_tokens:
        for c in c_tokens:
            # Prefix match in both directions catches stemming near-misses
            # ("landscap" vs "landscaping") without a full stemmer.
            if (
                q == c
                or (len(q) >= 4 and c.startswith(q))
                or (len(c) >= 4 and q.startswith(c))
            ):
                matched += 1
                break

    coverage = matched / len(q_tokens)
    if coverage == 0.0:
        return 0.0

    phrase_bonus = 0.0
    normalized_q = " ".join(q_tokens)
    normalized_c = " ".join(_tokens(corpus))
    if normalized_q and normalized_q in normalized_c:
        phrase_bonus = 0.25

    return min(1.0, coverage * 0.75 + phrase_bonus)


def rank_businesses_in_process(query: str, businesses: Iterable[dict]) -> list[dict]:
    """
    Fallback ranking over already-fetched `businesses` rows.

    Returns [{"business_id", "match_score", "match_reason"}] sorted best-first,
    dropping zero-score rows so unrelated businesses are excluded rather than
    tail-ranked.
    """
    ranked: list[dict] = []
    for biz in businesses:
        corpus = corpus_from_business(biz)
        score = lexical_rank(query, corpus)
        if score <= 0.0:
            continue
        ranked.append(
            {
                "business_id": biz.get("id"),
                "match_score": score,
                "match_reason": None,
            }
        )
    ranked.sort(key=lambda r: r["match_score"], reverse=True)
    return ranked


# ── Database-backed ranking ──────────────────────────────────────────────────


def _normalize_rows(rows) -> list[dict]:
    out: list[dict] = []
    for row in rows or []:
        bid = row.get("business_id")
        if not bid:
            continue
        out.append(
            {
                "business_id": bid,
                "match_score": float(row.get("match_score") or 0.0),
                "match_reason": row.get("match_reason"),
            }
        )
    return out


def rank_business_ids(
    client,
    query: str,
    category: Optional[str] = None,
    limit: int = CANDIDATE_CAP,
) -> Optional[list[dict]]:
    """
    Ask the database for business ids ranked by work-history relevance.

    Returns the ranked list, or **None** when the database cannot answer (RPC
    missing, migration not applied, transport error). None is the caller's
    signal to fall back in-process — it is deliberately distinct from `[]`,
    which means "the corpus was searched and nothing matched".

    Only ids + scores come back; the caller hydrates the rows itself so the
    ghost/suspended-owner filter (services/visibility.py) and the Haversine
    radius filter still apply before pagination.
    """
    q = (query or "").strip()
    if not q:
        return []

    params = {
        "p_query": q,
        "p_category": (category or "").strip() or None,
        "p_limit": max(1, min(int(limit or CANDIDATE_CAP), CANDIDATE_CAP)),
    }

    if semantic_search_available():
        try:
            embedding = embed_texts([q])[0]
            res = client.rpc(
                SEMANTIC_SEARCH_RPC,
                {
                    "p_embedding": embedding,
                    "p_category": params["p_category"],
                    "p_limit": params["p_limit"],
                },
            ).execute()
            return _normalize_rows(res.data)
        except Exception:
            # Never let the semantic path take search down — drop to lexical.
            logger.exception("semantic_search_failed_falling_back_to_lexical")

    try:
        res = client.rpc(WORK_SEARCH_RPC, params).execute()
        return _normalize_rows(res.data)
    except Exception:
        logger.exception("work_search_rpc_unavailable", extra={"query": q})
        return None


# ── Embedding provider (dormant) ─────────────────────────────────────────────


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Turn texts into `EMBEDDING_DIM`-wide vectors.

    NOT IMPLEMENTED — and deliberately not stubbed against a specific vendor.
    No embedding credential exists on this deployment, so any client written
    now would be untested guesswork tied to whichever provider we happen to
    pick. When one is chosen (Voyage AI is the usual pairing with Anthropic;
    Cohere and OpenAI also serve this shape):

        1. Set SEARCH_EMBEDDING_API_KEY / SEARCH_EMBEDDING_MODEL, and confirm
           the model's dimensionality equals EMBEDDING_DIM — if it differs,
           alter `business_work_index.embedding` to match before backfilling.
        2. Implement this function against that provider's batch endpoint,
           preserving input order in the returned list.
        3. Run `backfill_embeddings()`.
        4. Flip SEMANTIC_SEARCH_ENABLED to True.

    Everything else — column, HNSW cosine index, RPC, grants, flag, backfill
    loop, invalidation-on-corpus-change — is already in place.
    """
    raise EmbeddingUnavailable(
        "No embedding provider is configured. Set SEARCH_EMBEDDING_API_KEY and "
        "SEARCH_EMBEDDING_MODEL, implement search_index.embed_texts against "
        "that provider, then run backfill_embeddings()."
    )


def backfill_embeddings(client, batch_size: int = 50) -> int:
    """
    Embed every `business_work_index` row whose embedding is missing or stale.

    `refresh_business_work_index()` NULLs `embedding` whenever a business's
    corpus actually changes, so "embedding IS NULL" is exactly the set of rows
    needing work — this is both the initial backfill and the ongoing top-up.
    Returns the number of rows embedded. Raises EmbeddingUnavailable until a
    provider is wired up.
    """
    total = 0
    while True:
        res = (
            client.table("business_work_index")
            .select("business_id, corpus")
            .is_("embedding", "null")
            .limit(batch_size)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break

        vectors = embed_texts([r.get("corpus") or "" for r in rows])
        for row, vector in zip(rows, vectors):
            client.table("business_work_index").update(
                {
                    "embedding": vector,
                    "embedding_model": SEARCH_EMBEDDING_MODEL,
                    "embedded_at": "now()",
                }
            ).eq("business_id", row["business_id"]).execute()
            total += 1

        if len(rows) < batch_size:
            break

    logger.info("backfill_embeddings_done", extra={"rows": total})
    return total
