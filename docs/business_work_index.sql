-- =============================================================================
-- SwingBy — LANE F: work-history search index  (business_work_index)
--
-- WHY THIS EXISTS
--   `GET /businesses/?q=` used to be `ilike(business_name, '%q%')`. Typing
--   "big house" returned ZERO results, always, because no business is *named*
--   "big house". The owner's ask is the opposite of name matching:
--
--       "type a keyword like 'big house' and see companies that PROBABLY DID
--        THE SAME KIND OF JOB"
--
--   Nothing in the schema could answer that. `bookings` stores only
--   `service_category`; the human-written job text lives on `service_posts`
--   (title/description), authored by the CLIENT, and was never joined to the
--   business that actually WON and COMPLETED the job. So the searchable corpus
--   of "work this business has actually done" had to be BUILT. This file
--   builds it.
--
-- SHAPE — a refreshed TABLE, not a view / materialized view
--   * A plain VIEW would re-run the bookings⋈service_posts aggregation on
--     every keystroke of a debounced search box. No.
--   * A MATERIALIZED VIEW cannot carry a column we mutate independently of the
--     aggregation — and the embedding column is exactly that: it is written by
--     a backend backfill job, not derived in SQL. `REFRESH MATERIALIZED VIEW`
--     would blow the embeddings away on every refresh.
--   * So: a real table, keyed 1:1 to `businesses`, refreshed by
--     `refresh_business_work_index()`, driven by AFTER triggers on
--     `businesses` and `bookings` plus a nightly pg_cron full rebuild as the
--     drift backstop. Embeddings survive refreshes and are invalidated (set to
--     NULL) only when the corpus text actually changed.
--
-- TWO SEARCH PATHS, ONE TABLE
--   * LEXICAL (live today): weighted `tsvector` + pg_trgm `word_similarity`.
--     Completed-job text is weight 'A', the business's own profile text is
--     weight 'B' — so "did a job like this" outranks "is named like this",
--     which is the whole point.
--   * SEMANTIC (built, dormant): `embedding vector(1536)` + cosine distance.
--     There is no embedding-provider API key on this deployment, so the
--     backend keeps this path behind
--     `app.services.search_index.SEMANTIC_SEARCH_ENABLED` (same idiom as
--     `credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED`). The column, the index
--     and the RPC all exist so switching it on is a config change, not another
--     migration.
--
-- IDEMPOTENT: safe to re-run. Run in the Supabase SQL Editor (or via MCP).
-- =============================================================================


-- ── 1. Extensions ────────────────────────────────────────────────────────────
-- Supabase convention on this project is the `extensions` schema (pgcrypto,
-- uuid-ossp and pg_stat_statements already live there).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector  with schema extensions;


-- ── 2. The index table ───────────────────────────────────────────────────────
create table if not exists public.business_work_index (
    business_id  uuid primary key
                 references public.businesses (id) on delete cascade,

    -- The business's OWN words: name, category, custom category, description.
    profile_text text        not null default '',

    -- The words of jobs it has actually COMPLETED: service_post title +
    -- description + booking service_category, deduped. This is the corpus the
    -- owner's "probably did the same kind of job" question is answered from.
    work_text    text        not null default '',

    -- profile_text || work_text — the flat document pg_trgm scores against.
    corpus       text        not null default '',

    -- Weighted document: work_text at 'A', profile_text at 'B'.
    tsv          tsvector,

    -- How many completed bookings fed work_text (0 = profile-only business).
    job_count    integer     not null default 0,

    -- Semantic path (dormant until an embedding key is provisioned).
    embedding       extensions.vector(1536),
    embedding_model text,
    embedded_at     timestamptz,

    updated_at   timestamptz not null default now()
);

comment on table public.business_work_index is
    'LANE F: per-business searchable corpus of completed work. Maintained by '
    'refresh_business_work_index(); never edit by hand.';

-- Adds for re-runs against an older version of this table.
alter table public.business_work_index
    add column if not exists job_count       integer not null default 0,
    add column if not exists embedding       extensions.vector(1536),
    add column if not exists embedding_model text,
    add column if not exists embedded_at     timestamptz;

-- Lexical indexes.
create index if not exists business_work_index_tsv_idx
    on public.business_work_index using gin (tsv);

create index if not exists business_work_index_corpus_trgm_idx
    on public.business_work_index using gin (corpus extensions.gin_trgm_ops);

-- Semantic index. HNSW over cosine distance. Harmless while every embedding is
-- NULL (NULLs are not indexed), ready the moment the backfill runs.
create index if not exists business_work_index_embedding_idx
    on public.business_work_index using hnsw (embedding extensions.vector_cosine_ops);

-- RLS on, zero policies: the table is reachable only through the backend's
-- service_role client (which bypasses RLS). anon/authenticated get nothing,
-- and the security advisor stays quiet.
alter table public.business_work_index enable row level security;


-- ── 3. Refresh ───────────────────────────────────────────────────────────────
-- p_business_id NULL → rebuild every business (used by the nightly cron and by
-- the one-shot backfill at the bottom of this file).
create or replace function public.refresh_business_work_index(
    p_business_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_rows integer;
begin
    with src as (
        select
            b.id as business_id,
            btrim(concat_ws(' ',
                b.business_name,
                b.category,
                b.custom_category,
                b.description
            )) as profile_text,
            coalesce(j.work_text, '') as work_text,
            coalesce(j.job_count, 0)  as job_count
        from public.businesses b
        left join lateral (
            select
                string_agg(x.t, ' ')      as work_text,
                count(*)::int             as job_count
            from (
                -- DISTINCT so a business that did the same job title ten times
                -- does not swamp ts_rank with one repeated phrase.
                select distinct btrim(concat_ws(' ',
                           nullif(btrim(sp.title), ''),
                           nullif(btrim(sp.description), ''),
                           nullif(btrim(bk.service_category), '')
                       )) as t
                from public.bookings bk
                left join public.service_posts sp on sp.id = bk.post_id
                where bk.business_id = b.id
                  and bk.status = 'completed'
            ) x
            where x.t is not null and x.t <> ''
        ) j on true
        where p_business_id is null or b.id = p_business_id
    )
    insert into public.business_work_index as w (
        business_id, profile_text, work_text, corpus, tsv, job_count, updated_at
    )
    select
        s.business_id,
        s.profile_text,
        s.work_text,
        btrim(concat_ws(' ', s.profile_text, s.work_text)),
        setweight(to_tsvector('english', coalesce(s.work_text, '')),    'A')
        || setweight(to_tsvector('english', coalesce(s.profile_text, '')), 'B'),
        s.job_count,
        now()
    from src s
    on conflict (business_id) do update set
        profile_text = excluded.profile_text,
        work_text    = excluded.work_text,
        corpus       = excluded.corpus,
        tsv          = excluded.tsv,
        job_count    = excluded.job_count,
        updated_at   = now(),
        -- Corpus changed → any stored embedding now describes text that no
        -- longer exists. Drop it so the backfill re-embeds; keep it otherwise
        -- so a routine refresh does not burn embedding spend.
        embedding = case
                        when w.corpus is distinct from excluded.corpus
                        then null else w.embedding end,
        embedding_model = case
                        when w.corpus is distinct from excluded.corpus
                        then null else w.embedding_model end,
        embedded_at = case
                        when w.corpus is distinct from excluded.corpus
                        then null else w.embedded_at end;

    get diagnostics v_rows = row_count;
    return v_rows;
end;
$$;


-- ── 4. Triggers — keep the index warm ────────────────────────────────────────
create or replace function public.trg_businesses_refresh_work_index()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    perform public.refresh_business_work_index(new.id);
    return new;
end;
$$;

drop trigger if exists businesses_refresh_work_index on public.businesses;
create trigger businesses_refresh_work_index
    after insert or update of business_name, category, custom_category, description
    on public.businesses
    for each row
    execute function public.trg_businesses_refresh_work_index();


create or replace function public.trg_bookings_refresh_work_index()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if tg_op = 'DELETE' then
        if old.status = 'completed' then
            perform public.refresh_business_work_index(old.business_id);
        end if;
        return old;
    end if;

    -- Only completion transitions can change work_text (either direction: a
    -- booking becoming completed adds text, one leaving completed removes it).
    if new.status = 'completed'
       or (tg_op = 'UPDATE' and old.status = 'completed') then
        perform public.refresh_business_work_index(new.business_id);
        if tg_op = 'UPDATE' and old.business_id is distinct from new.business_id then
            perform public.refresh_business_work_index(old.business_id);
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists bookings_refresh_work_index on public.bookings;
create trigger bookings_refresh_work_index
    after insert or update or delete
    on public.bookings
    for each row
    execute function public.trg_bookings_refresh_work_index();


-- ── 5. Lexical search RPC — the LIVE path ────────────────────────────────────
-- Returns ranked business ids only. The backend hydrates the rows itself so it
-- can still apply the ghost/suspended-owner filter (services/visibility.py) and
-- the Haversine radius filter before paginating — none of which belong in SQL.
create or replace function public.search_businesses_by_work(
    p_query    text,
    p_category text default null,
    p_limit    int  default 100
)
returns table (
    business_id  uuid,
    match_score  double precision,
    match_reason text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
    v_q   text := btrim(coalesce(p_query, ''));
    v_tsq tsquery;
begin
    if v_q = '' then
        return;
    end if;

    -- OR-of-prefixes, deliberately NOT plainto_/websearch_to_tsquery.
    -- Those AND every term together, so "big house" only matches a corpus
    -- containing BOTH words — which is the same dead end as the old ilike.
    -- OR-ing makes any term a candidate and lets ts_rank_cd reward the
    -- businesses that match MORE of them; ':*' catches "clean" → "cleaning".
    select to_tsquery('english', string_agg(quote_literal(lexeme) || ':*', ' | '))
      into v_tsq
      from unnest(to_tsvector('english', v_q));

    return query
    select
        w.business_id,
        (
            -- weights are {D,C,B,A}: completed work ('A') dominates the
            -- business's own marketing words ('B').
            coalesce(
                ts_rank_cd('{0.1,0.2,0.3,1.0}'::float4[], w.tsv, v_tsq, 32),
                0
            )::double precision * 8.0
            -- Trigram fallback: catches typos and word fragments that never
            -- become a matching lexeme ("cleening", "housecleaning").
            + coalesce(extensions.word_similarity(v_q, w.work_text), 0)::double precision * 2.0
            + coalesce(extensions.word_similarity(v_q, w.profile_text), 0)::double precision
        )::double precision as match_score,
        case
            when v_tsq is null or w.work_text = '' then null
            -- StartSel/StopSel MUST be quoted-empty: bare `StartSel=,` makes
            -- the option parser swallow the next key and the marker text leaks
            -- into the snippet. Mobile renders plain text, so no <b> markers.
            else nullif(btrim(ts_headline('english', w.work_text, v_tsq,
                     'StartSel="",StopSel="",MaxWords=12,MinWords=3,MaxFragments=1')), '')
        end as match_reason
    from public.business_work_index w
    join public.businesses b on b.id = w.business_id
    where (p_category is null
           or btrim(p_category) = ''
           or b.category ilike btrim(p_category))
      and (
            (v_tsq is not null and w.tsv @@ v_tsq)
            or extensions.word_similarity(v_q, w.corpus) >= 0.45
          )
    order by match_score desc, b.avg_rating desc nulls last, w.job_count desc
    limit greatest(coalesce(p_limit, 100), 1);
end;
$$;


-- ── 6. Semantic search RPC — built, dormant ──────────────────────────────────
-- Identical contract to search_businesses_by_work so the backend can swap
-- between them behind one feature flag. Ranks by cosine similarity
-- (1 - cosine distance). Returns nothing while no rows are embedded.
create or replace function public.search_businesses_semantic(
    p_embedding extensions.vector(1536),
    p_category  text default null,
    p_limit     int  default 100,
    p_min_score double precision default 0.15
)
returns table (
    business_id  uuid,
    match_score  double precision,
    match_reason text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select
        w.business_id,
        (1 - (w.embedding operator(extensions.<=>) p_embedding))::double precision as match_score,
        left(nullif(w.work_text, ''), 160) as match_reason
    from public.business_work_index w
    join public.businesses b on b.id = w.business_id
    where w.embedding is not null
      and (p_category is null
           or btrim(p_category) = ''
           or b.category ilike btrim(p_category))
      and (1 - (w.embedding operator(extensions.<=>) p_embedding)) >= coalesce(p_min_score, 0.15)
    order by match_score desc, b.avg_rating desc nulls last
    limit greatest(coalesce(p_limit, 100), 1);
$$;


-- ── 7. Grants ────────────────────────────────────────────────────────────────
-- Backend-only. anon/authenticated must not be able to call these directly.
revoke all on function public.refresh_business_work_index(uuid) from public;
revoke all on function public.search_businesses_by_work(text, text, int) from public;
revoke all on function public.search_businesses_semantic(extensions.vector, text, int, double precision) from public;

grant execute on function public.refresh_business_work_index(uuid) to service_role;
grant execute on function public.search_businesses_by_work(text, text, int) to service_role;
grant execute on function public.search_businesses_semantic(extensions.vector, text, int, double precision) to service_role;


-- ── 8. Nightly full rebuild — drift backstop ─────────────────────────────────
-- The triggers cover the normal paths; this catches anything that edited the
-- source tables out-of-band (SQL editor, admin scripts, backfills).
create extension if not exists pg_cron;

select cron.unschedule('refresh-business-work-index')
where exists (
    select 1 from cron.job where jobname = 'refresh-business-work-index'
);

select cron.schedule(
    'refresh-business-work-index',
    '17 4 * * *',                                    -- 04:17 UTC daily
    $$select public.refresh_business_work_index();$$
);


-- ── 9. Backfill every existing business ──────────────────────────────────────
select public.refresh_business_work_index();


-- ── Verify ───────────────────────────────────────────────────────────────────
-- select extname from pg_extension where extname in ('vector','pg_trgm');
-- select count(*) filter (where job_count > 0) as with_work, count(*) as total
--   from public.business_work_index;
-- select * from public.search_businesses_by_work('big house', null, 10);
