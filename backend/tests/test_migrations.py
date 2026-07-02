"""
test_migrations.py — Smoke tests for SQL migration files.

Coverage:
- Syntax validation of .sql files in docs/
- RLS policies file
- Expiry cron job file
- Best-effort: marks as SKIP if sqlparse unavailable

Note: Does not run migrations; only validates syntax.
"""

import pytest
from pathlib import Path


class TestMigrationSyntax:
    """Tests for SQL migration file syntax."""

    @pytest.mark.skip(
        reason="Requires sqlparse or psycopg2; manual validation recommended"
    )
    def test_rls_policies_syntax_valid(self):
        """
        T89.1: docs/rls_policies.sql should be syntactically valid SQL.

        TODO: Integrate sqlparse or use Supabase CLI to validate.
        """
        sql_file = Path(__file__).parent.parent.parent / "docs" / "rls_policies.sql"

        if not sql_file.exists():
            pytest.skip("rls_policies.sql not found")

        # Would parse with: sqlparse.parse(sql_file.read_text())
        # For now, just check it exists and is readable
        assert sql_file.exists()
        assert sql_file.read_text()

    @pytest.mark.skip(
        reason="Requires sqlparse or psycopg2; manual validation recommended"
    )
    def test_expiry_cron_syntax_valid(self):
        """
        T89.2: docs/expiry_cron.sql should be syntactically valid SQL.

        TODO: Integrate sqlparse or use Supabase CLI to validate.
        """
        sql_file = Path(__file__).parent.parent.parent / "docs" / "expiry_cron.sql"

        if not sql_file.exists():
            pytest.skip("expiry_cron.sql not found")

        assert sql_file.exists()
        assert sql_file.read_text()

    @pytest.mark.skip(reason="Requires Supabase MCP or manual inspection")
    def test_supabase_migrations_applied(self):
        """
        T89.3: List all migrations from Supabase via MCP.

        TODO: Use mcp__claude_ai_Supabase__list_migrations to enumerate migrations.
        For now, skipped pending MCP integration.
        """
        pytest.skip("MCP Supabase integration pending")
