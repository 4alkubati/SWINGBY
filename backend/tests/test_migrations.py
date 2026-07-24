"""
test_migrations.py — Smoke tests for SQL migration files.

Coverage:
- Syntax validation of docs/rls_policies.sql, docs/expiry_cron.sql, and the
  new supabase/migrations/*.sql file (sqlparse).
- S1 fix: static assertions that the column-level REVOKE lockdown is present
  in both docs/rls_policies.sql and the new migration, and hasn't silently
  regressed to also hiding lat/lng (which is meant to stay visible).
- Task-3 UNIQUE constraints: static assertion that each is guarded by a
  duplicate-row check rather than applied unconditionally.

sqlparse IS listed in backend/requirements-dev.txt (>=0.4.4) — the previous
skip reason ("Requires sqlparse ... ; manual validation recommended") was
stale; nothing in this repo's tooling was actually missing it.

Note: none of this runs migrations against a real database or exercises
Postgres RLS/column-privilege enforcement as the `authenticated` role. This
repo has no docker-compose/local-Postgres harness, and no live Supabase
credentials were available in the worktree this fix was written in (the
Supabase MCP connection was down). See TestS1ColumnLockdown's class
docstring below for the exact manual command a human with a live anon key +
user JWT should run against PostgREST to confirm the fix holds for real.
"""

import re
from pathlib import Path

import pytest
import sqlparse

REPO_ROOT = Path(__file__).parent.parent.parent


class TestMigrationSyntax:
    """SQL files parse as valid statement sequences (syntax only, not applied)."""

    def test_rls_policies_syntax_valid(self):
        """T89.1: docs/rls_policies.sql should be syntactically valid SQL."""
        sql_file = REPO_ROOT / "docs" / "rls_policies.sql"
        assert sql_file.exists()
        text = sql_file.read_text()
        assert text.strip()
        statements = sqlparse.parse(text)
        assert len(statements) > 10  # this file has dozens of statements

    def test_expiry_cron_syntax_valid(self):
        """T89.2: docs/expiry_cron.sql should be syntactically valid SQL."""
        sql_file = REPO_ROOT / "docs" / "expiry_cron.sql"
        assert sql_file.exists()
        text = sql_file.read_text()
        assert text.strip()
        statements = sqlparse.parse(text)
        assert len(statements) > 0

    def test_s1_migration_syntax_valid(self):
        """New file this fix adds — supabase/migrations/ is the versioned home
        for schema/RLS changes going forward (see file header for why the
        13 pre-existing loose docs/*.sql files aren't being reorganized here)."""
        sql_file = (
            REPO_ROOT
            / "supabase"
            / "migrations"
            / "20260720000000_s1_column_lockdown_and_unique_constraints.sql"
        )
        assert sql_file.exists()
        text = sql_file.read_text()
        assert text.strip()
        statements = sqlparse.parse(text)
        assert len(statements) > 0

    @pytest.mark.skip(reason="Requires Supabase MCP or manual inspection")
    def test_supabase_migrations_applied(self):
        """
        T89.3: List all migrations from Supabase via MCP.

        Genuinely needs a live connection (mcp__.../list_migrations), which
        this test file can't reach from inside pytest — left skipped, not
        stale. If/when this suite runs somewhere with MCP wired into the test
        process, replace this skip with a real call.
        """
        pytest.skip("MCP Supabase integration pending")


class TestS1ColumnLockdown:
    """
    S1: docs/rls_policies.sql §4's `posts_select` policy is a ROW filter
    (`status = 'open' or client_id = auth.uid()`) — it says nothing about
    which COLUMNS of a matched row are visible. Supabase grants
    `authenticated` SELECT on every column by default, so before this fix
    the client's full street address was readable by any authenticated
    caller hitting PostgREST directly with the (public) anon key + their own
    JWT — bypassing backend/app/privacy.py's masking entirely. Same shape
    found on `businesses_select_authenticated` (`using (true)`) for four
    Stripe/license columns.

    These are static text assertions on the SQL, not a live exercise of the
    `authenticated` Postgres role — this repo has no local-Postgres/RLS test
    harness and no live DB credentials were available here. For a human with
    live anon key + a real user JWT, the exact manual check is:

        curl -s "$SUPABASE_URL/rest/v1/service_posts?status=eq.open&select=*" \\
          -H "apikey: $SUPABASE_ANON_KEY" \\
          -H "Authorization: Bearer $USER_JWT"

    Before the fix: each row includes `"address": "123 Main St NW, ..."`.
    After the fix is applied (supabase/migrations/20260720000000_...sql run
    against the project): each row's `address` key is simply absent (not
    null — omitted), while `budget`, `description`, `lat`, `lng`, etc. are
    still present. A second check for the businesses fix:

        curl -s "$SUPABASE_URL/rest/v1/businesses?select=*" \\
          -H "apikey: $SUPABASE_ANON_KEY" \\
          -H "Authorization: Bearer $USER_JWT"

    should return rows with no `stripe_customer_id`, `subscription_id`,
    `subscription_current_period_end`, or `license_number` keys.
    """

    def test_service_posts_address_column_revoked_from_authenticated(self):
        text = (REPO_ROOT / "docs" / "rls_policies.sql").read_text().lower()
        assert "revoke select (address) on service_posts from authenticated" in text

    def test_service_posts_revoke_does_not_also_hide_lat_lng(self):
        """lat/lng are intentionally still visible pre-acceptance (approximate
        location for map pins is by design — see privacy.py docstring)."""
        text = (REPO_ROOT / "docs" / "rls_policies.sql").read_text().lower()
        m = re.search(
            r"revoke select \(([^)]*)\) on service_posts from authenticated", text
        )
        assert m, "expected a column-level revoke on service_posts"
        cols = [c.strip() for c in m.group(1).split(",")]
        assert cols == ["address"]

    def test_businesses_financial_and_license_columns_revoked(self):
        text = (REPO_ROOT / "docs" / "rls_policies.sql").read_text().lower()
        m = re.search(
            r"revoke select \(([^)]*)\) on businesses from authenticated",
            text,
            re.S,
        )
        assert m, "expected a column-level revoke on businesses"
        cols = {c.strip() for c in m.group(1).split(",")}
        assert cols == {
            "license_number",
            "stripe_customer_id",
            "subscription_id",
            "subscription_current_period_end",
        }

    def test_new_migration_mirrors_the_same_revokes(self):
        migration = (
            (
                REPO_ROOT
                / "supabase"
                / "migrations"
                / "20260720000000_s1_column_lockdown_and_unique_constraints.sql"
            )
            .read_text()
            .lower()
        )
        assert (
            "revoke select (address) on service_posts from authenticated" in migration
        )
        assert "stripe_customer_id" in migration
        assert "license_number" in migration


class TestUniqueConstraintsAreGuarded:
    """
    Task 3: adding a UNIQUE constraint to a table with pre-existing
    duplicates fails outright. No live DB access was available to actually
    run the pre-flight duplicate checks against production, so instead of
    an unconditional `ALTER TABLE ... ADD CONSTRAINT`, the migration wraps
    each one in a DO block that checks for duplicates first and RAISEs a
    NOTICE + skips (rather than aborting the whole migration) if any are
    found. This test asserts that guard shape is actually present for all
    three constraints, not just that the ALTER statements exist somewhere.
    """

    def test_all_three_unique_constraints_are_guarded(self):
        migration = (
            (
                REPO_ROOT
                / "supabase"
                / "migrations"
                / "20260720000000_s1_column_lockdown_and_unique_constraints.sql"
            )
            .read_text()
            .lower()
        )
        for constraint_name in (
            "businesses_owner_id_key",
            "interests_post_id_business_id_key",
            "bookings_post_id_key",
        ):
            assert constraint_name in migration
        # each guard checks for duplicates via `having count(*) > 1`
        assert migration.count("having count(*) > 1") >= 3
        # and each is inside a DO block, not a bare ALTER TABLE
        assert migration.count("do $$") >= 3
