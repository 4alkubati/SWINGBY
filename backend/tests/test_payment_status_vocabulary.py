"""
test_payment_status_vocabulary.py — PAYMENT-MODEL.md §9 item 2, the
highest-value test in the spec.

"A test that collects every status literal written anywhere in backend/app
and every status literal read in any filter, and asserts the read set is a
subset of the write set. The diagnostic found payments.py filtering on
held/partial_released and businesses.py filtering on settled — three values
nothing ever wrote, so two endpoints returned hard zero forever."

How this scanner disambiguates "status" (used by bookings.status,
interests.status, service_posts.status, disputes.status, ... — NOT just the
payment vocabulary) from payments.status specifically: it traces, per module,
which local variable names came from a `supabase.table("payments")...`
call (including one hop through `.data`/`for x in y.data`), and only treats a
bare "status" key as payment-vocabulary when it's read/written through one of
those. "payment_status" is always in-scope regardless of table, since it is
never used for anything but bookings.payment_status in this codebase.

This is necessarily a heuristic static scanner, not a type checker — it is
tuned to this codebase's actual call patterns (verified against every hit
below), not a general-purpose one. If it ever mis-detects a new pattern,
prefer fixing the scanner's precision over loosening the assertion.

Known, itemized exceptions (NOT payment_ledger's scope to fix — see comments
inline): businesses.py's earnings-reader filters payments on `status ==
"settled"`, a value nothing writes (the endpoint returns a hard 0 today).
Owned by the invoices/earnings-reader work (PAYMENT-MODEL.md §6 invoice
part), tracked separately from this agent's scope (§3/§4/§5/§8).
"""

from __future__ import annotations

import ast
from pathlib import Path

from app.services import payment_status as _payment_status_module

APP_DIR = Path(__file__).parent.parent / "app"

_STATUS_KEYS = {"status", "payment_status"}

# (file relative to backend/app, literal value) pairs that are READ somewhere
# against the payments table / bookings.payment_status but have no
# corresponding WRITE anywhere in backend/app today. Each entry here is a
# pre-existing, itemized, out-of-scope defect — not something this test
# should silently ignore, and not something to fix by inventing a new value.
# Removing an entry here (because a sibling change made it obsolete) should
# make the test start requiring proof the value is now written somewhere.
_KNOWN_UNRESOLVED_READS = {
    # businesses.py earnings-reader: filters on a value nothing writes, so
    # total_earnings is a hard 0 today. Owned by the invoices/earnings-reader
    # sibling work (out of this agent's scope — see PAYMENT-MODEL.md §6).
    ("api/businesses.py", "settled"),
}


def _root_name(node: ast.AST) -> str | None:
    """Unwrap a `.data` attribute access (`X.data` -> `X`) and return the
    base Name, or None if this isn't a simple Name/`.data` chain."""
    if isinstance(node, ast.Attribute) and node.attr == "data":
        node = node.value
    if isinstance(node, ast.BoolOp):
        # `X.data or []` / `X.data or {}` — take the first operand.
        if node.values:
            return _root_name(node.values[0])
        return None
    if isinstance(node, ast.Name):
        return node.id
    return None


def _table_in_expr(node: ast.AST) -> str | None:
    """Find the first `supabase.table("X")` call anywhere in this
    expression subtree and return "X"."""
    for n in ast.walk(node):
        if (
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr == "table"
            and n.args
            and isinstance(n.args[0], ast.Constant)
            and isinstance(n.args[0].value, str)
        ):
            return n.args[0].value
    return None


def _table_call_of(node: ast.Call) -> str | None:
    """For `supabase.table("payments").insert(...)` / `.update(...)`, return
    "payments" — the table name from the immediate `.table(...)` call in this
    Call's receiver chain."""
    receiver = node.func.value if isinstance(node.func, ast.Attribute) else None
    if receiver is None:
        return None
    return _table_in_expr(receiver)


def _resolve_str_value(node: ast.AST) -> str | None:
    """
    Resolve a node to its string value if possible:
      - a plain string literal ("held"), or
      - `payment_status.HELD` — the module's own named constants, resolved
        against the REAL module (app/services/payment_status.py), since the
        code (correctly) writes/reads these as symbols, not repeated string
        literals. A scanner that only understood literal strings would call
        every one of this codebase's own vocabulary-constant usages a
        "read with no writer" false positive the moment the code stopped
        typing the same string twice.
    """
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "payment_status"
    ):
        val = getattr(_payment_status_module, node.attr, None)
        if isinstance(val, str):
            return val
    return None


def _dict_str_items(node: ast.Dict, keys: set[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in zip(node.keys, node.values):
        if isinstance(k, ast.Constant) and isinstance(k.value, str) and k.value in keys:
            resolved = _resolve_str_value(v)
            if resolved is not None:
                out[k.value] = resolved
    return out


def _extract_str_constants(node: ast.AST) -> list[str]:
    resolved = _resolve_str_value(node)
    if resolved is not None:
        return [resolved]
    if isinstance(node, (ast.Tuple, ast.List, ast.Set)):
        out: list[str] = []
        for elt in node.elts:
            out.extend(_extract_str_constants(elt))
        return out
    return []


def _status_key_and_root(node: ast.AST) -> tuple[str, str | None] | None:
    """If node is `X.get("status"/"payment_status")` or
    `X["status"/"payment_status"]`, return (key, root_name_of_X)."""
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "get"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and node.args[0].value in _STATUS_KEYS
    ):
        return node.args[0].value, _root_name(node.func.value)
    if isinstance(node, ast.Subscript):
        key_node = node.slice
        if isinstance(key_node, ast.Constant) and key_node.value in _STATUS_KEYS:
            return key_node.value, _root_name(node.value)
    return None


def _scope_nodes(scope: ast.AST):
    """
    Every node within `scope`, NOT descending into nested function defs
    (each is analyzed as its own independent scope by the caller). This is
    what keeps common local variable names — `update`, `row`, `p` — from
    bleeding across unrelated functions: payment_ledger.py has THREE
    functions that each build a local dict named `update`/`row` for a
    different table transition; without per-function scoping, the last one
    walked would silently clobber the others in a shared name -> dict map.
    """
    stack = list(ast.iter_child_nodes(scope))
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue  # nested scope — walked separately
        yield node
        stack.extend(ast.iter_child_nodes(node))


def _analyze_scope(scope: ast.AST) -> tuple[set[str], set[str]]:
    """Analyze one lexical scope (a function body, or the module's own
    top-level statements) in isolation. See `_scope_nodes`."""
    nodes = [scope] + list(_scope_nodes(scope))

    # Resolve local variables that carry rows from `.table("X")` (including
    # dict-literal locals passed to `.insert(var)`/`.update(var)`), to a
    # fixpoint so multi-hop chains resolve regardless of source order:
    #   pay = supabase.table("payments")...execute()
    #   items = pay.data or []
    #   for p in items:            (or: ... for p in items if ...)
    #     p.get("status")
    var_table: dict[str, str] = {}
    dict_literal_vars: dict[str, ast.Dict] = {}
    changed = True
    for _ in range(4):
        if not changed:
            break
        changed = False
        for node in nodes:
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = (
                    node.targets if isinstance(node, ast.Assign) else [node.target]
                )
                value = node.value
                if value is None:
                    continue
                if isinstance(value, ast.Dict):
                    for t in targets:
                        if isinstance(t, ast.Name):
                            dict_literal_vars[t.id] = value
                table = _table_in_expr(value)
                if table is None:
                    root = _root_name(value)
                    if root and root in var_table:
                        table = var_table[root]
                if table:
                    for t in targets:
                        if isinstance(t, ast.Name) and var_table.get(t.id) != table:
                            var_table[t.id] = table
                            changed = True
            elif isinstance(node, (ast.For, ast.comprehension)):
                target = node.target
                if isinstance(target, ast.Name):
                    table = _table_in_expr(node.iter)
                    if table is None:
                        root = _root_name(node.iter)
                        if root and root in var_table:
                            table = var_table[root]
                    if table and var_table.get(target.id) != table:
                        var_table[target.id] = table
                        changed = True

    writes: set[str] = set()
    reads: set[str] = set()

    for node in nodes:
        # Writes: `.table("payments").insert({...})` / `.update({...})`, and
        # the same with a dict-literal variable instead of an inline dict.
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in ("insert", "update")
            and node.args
        ):
            table = _table_call_of(node)
            if table is None:
                continue
            arg = node.args[0]
            payload = arg if isinstance(arg, ast.Dict) else None
            if payload is None and isinstance(arg, ast.Name):
                payload = dict_literal_vars.get(arg.id)
            if payload is None:
                continue
            if table == "payments":
                writes.update(_dict_str_items(payload, {"status"}).values())
            writes.update(_dict_str_items(payload, {"payment_status"}).values())

        # Reads: `X.get("status"/"payment_status")` / `X["..."]` compared via
        # ==, !=, in, not in against string constant(s).
        if isinstance(node, ast.Compare):
            info = _status_key_and_root(node.left)
            if info is None:
                continue
            key, root = info
            table = var_table.get(root) if root else None
            relevant = key == "payment_status" or (
                key == "status" and table == "payments"
            )
            if not relevant:
                continue
            for comparator in node.comparators:
                reads.update(_extract_str_constants(comparator))

    return writes, reads


def _scan_module(path: Path) -> tuple[set[str], set[str]]:
    """Returns (writes, reads) of payment-vocabulary status literals in one
    file, analyzing each function — and the module's own top-level
    statements — as an independent scope (see `_analyze_scope`)."""
    tree = ast.parse(path.read_text())

    writes: set[str] = set()
    reads: set[str] = set()

    scopes = [tree] + [
        n
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    for scope in scopes:
        w, r = _analyze_scope(scope)
        writes.update(w)
        reads.update(r)

    return writes, reads


def _all_writes_and_reads() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    writes_by_file: dict[str, set[str]] = {}
    reads_by_file: dict[str, set[str]] = {}
    for path in sorted(APP_DIR.rglob("*.py")):
        rel = str(path.relative_to(APP_DIR))
        writes, reads = _scan_module(path)
        if writes:
            writes_by_file[rel] = writes
        if reads:
            reads_by_file[rel] = reads
    return writes_by_file, reads_by_file


class TestPaymentStatusVocabulary:
    def test_scanner_finds_the_known_write_sites(self):
        """Sanity check on the scanner itself — if these stop showing up,
        the scanner broke, not the codebase."""
        writes_by_file, _ = _all_writes_and_reads()
        all_writes = set().union(*writes_by_file.values())
        for expected in ("held", "partial_released", "fully_released", "refunded"):
            assert expected in all_writes, (
                f"scanner did not find any write of {expected!r} — "
                "check _scan_module's table-tracing logic"
            )

    def test_scanner_finds_the_known_diagnostic_read_sites(self):
        """The three reads the diagnostic named as evidence the vocabulary
        had drifted (PAYMENT-MODEL.md §4). If backend/app/api/payments.py or
        businesses.py's earnings query shape changes, this pins down that the
        scanner still sees them."""
        _, reads_by_file = _all_writes_and_reads()
        assert "held" in reads_by_file.get("api/payments.py", set())
        assert "partial_released" in reads_by_file.get("api/payments.py", set())
        assert "settled" in reads_by_file.get("api/businesses.py", set())

    def test_read_set_is_a_subset_of_write_set(self):
        """
        The enforcement test. Every payments.status / bookings.payment_status
        literal that ANY code filters on must be a literal that SOME code
        writes — otherwise that filter is structurally dead (always false),
        which is exactly how `payments.py` (held/partial_released) and
        `businesses.py` (settled) each silently returned zero forever.
        """
        writes_by_file, reads_by_file = _all_writes_and_reads()
        all_writes = set().union(*writes_by_file.values()) if writes_by_file else set()

        unresolved: set[tuple[str, str]] = set()
        for file, reads in reads_by_file.items():
            for value in reads - all_writes:
                unresolved.add((file, value))

        unexpected = unresolved - _KNOWN_UNRESOLVED_READS
        assert not unexpected, (
            "found status/payment_status literal(s) read but never written "
            f"anywhere in backend/app: {sorted(unexpected)}. Either something "
            "writes this value and the scanner missed it, or this is a dead "
            "filter (PAYMENT-MODEL.md §4) that needs fixing or itemizing in "
            "_KNOWN_UNRESOLVED_READS with an explanation."
        )

        # And the flip side: every entry in the allowlist must still actually
        # be unresolved — an allowlist entry for a bug someone already fixed
        # is worse than no test at all (it hides a regression check).
        stale_allowlist_entries = _KNOWN_UNRESOLVED_READS - unresolved
        assert not stale_allowlist_entries, (
            "these _KNOWN_UNRESOLVED_READS entries are now resolved (something "
            f"writes them) — remove them from the allowlist: {sorted(stale_allowlist_entries)}"
        )

    def test_new_vocabulary_values_are_only_the_seven_permitted(self):
        """
        Every literal WRITTEN to payments.status / bookings.payment_status
        anywhere in backend/app must be one of the seven values in
        app/services/payment_status.py — no file is allowed to reintroduce
        an old-vocabulary value ('partial', 'paid_full', 'pending', 'settled')
        now that the migration has shipped.
        """
        from app.services import payment_status

        writes_by_file, _ = _all_writes_and_reads()
        offenders: list[tuple[str, str]] = []
        for file, values in writes_by_file.items():
            for v in values:
                if v not in payment_status.ALL:
                    offenders.append((file, v))
        assert not offenders, (
            f"found writes of non-vocabulary status values: {sorted(offenders)} "
            "— every write must use a value from app/services/payment_status.py"
        )
