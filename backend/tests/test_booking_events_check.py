"""
test_booking_events_check.py — CARD-02: booking_events.event_type CHECK migration.

The original DDL (docs/booking_events_and_photos.sql) rejects the three event
types the backend actually writes from the dispute and off-platform-payment
flows, and both call sites swallow the insert error — so the timeline rows are
silently lost. docs/booking_events_event_type_extend.sql widens the CHECK.

These tests run against a real throwaway Postgres 16 (Docker, container
removed on teardown — no live/shared database is touched):

1. apply the original DDL verbatim and prove each new event type violates
   the CHECK (the bug),
2. apply the migration file verbatim,
3. insert each of dispute_opened / dispute_resolved / paid_offplatform and
   assert the timeline query (same shape as GET /bookings/{id}/events:
   filter by booking_id, order by created_at asc) returns them,
4. confirm an original event type still inserts and garbage is still rejected.

Skips (rather than fails) when docker or the postgres:16-alpine image is
unavailable, so the stub-based suite stays runnable anywhere.
"""

import shutil
import subprocess
import time
import uuid
from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2")
from psycopg2 import errors  # noqa: E402

DOCS = Path(__file__).parent.parent.parent / "docs"
ORIGINAL_DDL = DOCS / "booking_events_and_photos.sql"
MIGRATION = DOCS / "booking_events_event_type_extend.sql"

NEW_EVENT_TYPES = ["dispute_opened", "dispute_resolved", "paid_offplatform"]

# Minimal stand-ins for what the original DDL references: the tables its
# FKs and RLS policy join against, the `authenticated` role the policy is
# granted to, and Supabase's auth.uid().
PREREQ_SQL = """
do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
    end if;
end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
    language sql stable as $$ select null::uuid $$;

create table public.users (
    id uuid primary key default gen_random_uuid()
);
create table public.businesses (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references public.users(id)
);
create table public.employees (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id)
);
create table public.bookings (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references public.users(id),
    business_id uuid references public.businesses(id),
    employee_id uuid references public.employees(id)
);
"""


@pytest.fixture(scope="module")
def pg_conn():
    """Throwaway Postgres 16 in Docker; yields an autocommit connection."""
    if shutil.which("docker") is None:
        pytest.skip("docker not available")

    name = f"swingby-card02-{uuid.uuid4().hex[:8]}"
    run = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "-e",
            "POSTGRES_PASSWORD=test",
            "-e",
            "POSTGRES_DB=swingby_test",
            "-p",
            "127.0.0.1::5432",
            "postgres:16-alpine",
        ],
        capture_output=True,
        text=True,
    )
    if run.returncode != 0:
        pytest.skip(f"could not start postgres container: {run.stderr.strip()}")

    try:
        port_out = (
            subprocess.run(
                ["docker", "port", name, "5432/tcp"],
                capture_output=True,
                text=True,
                check=True,
            )
            .stdout.strip()
            .splitlines()[0]
        )
        port = int(port_out.rsplit(":", 1)[1])

        conn = None
        deadline = time.monotonic() + 60
        while conn is None:
            try:
                conn = psycopg2.connect(
                    host="127.0.0.1",
                    port=port,
                    user="postgres",
                    password="test",
                    dbname="swingby_test",
                    connect_timeout=3,
                )
            except psycopg2.OperationalError:
                if time.monotonic() > deadline:
                    pytest.skip("postgres container did not become ready in 60s")
                time.sleep(0.5)

        conn.autocommit = True
        yield conn
        conn.close()
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)


@pytest.fixture(scope="module")
def db(pg_conn):
    """Prereq tables + the original booking_events DDL, plus one seeded booking."""
    with pg_conn.cursor() as cur:
        cur.execute(PREREQ_SQL)
        cur.execute(ORIGINAL_DDL.read_text())
        cur.execute("insert into public.users default values returning id")
        actor_id = cur.fetchone()[0]
        cur.execute(
            "insert into public.bookings (client_id) values (%s) returning id",
            (actor_id,),
        )
        booking_id = cur.fetchone()[0]
    return {"conn": pg_conn, "booking_id": booking_id, "actor_id": actor_id}


def _insert_event(db, event_type, created_at=None):
    with db["conn"].cursor() as cur:
        cur.execute(
            """
            insert into public.booking_events
                (booking_id, actor_id, event_type, note, created_at)
            values (%s, %s, %s, %s, coalesce(%s, now()))
            returning id
            """,
            (
                db["booking_id"],
                db["actor_id"],
                event_type,
                f"test {event_type}",
                created_at,
            ),
        )
        return cur.fetchone()[0]


def _timeline(db):
    """Same query GET /bookings/{id}/events runs: by booking, created_at asc."""
    with db["conn"].cursor() as cur:
        cur.execute(
            """
            select event_type from public.booking_events
            where booking_id = %s
            order by created_at asc
            limit 50
            """,
            (db["booking_id"],),
        )
        return [row[0] for row in cur.fetchall()]


class TestBookingEventsCheckMigration:
    """Ordered: bug repro → apply migration → per-type insert + timeline."""

    def test_premigration_check_rejects_new_event_types(self, db):
        for event_type in NEW_EVENT_TYPES:
            with pytest.raises(errors.CheckViolation):
                _insert_event(db, event_type)
        assert _timeline(db) == []

    def test_migration_applies_cleanly(self, db):
        with db["conn"].cursor() as cur:
            cur.execute(MIGRATION.read_text())
            cur.execute("""
                select pg_get_constraintdef(oid) from pg_constraint
                where conname = 'booking_events_event_type_check'
                """)
            constraint_def = cur.fetchone()[0]
        for event_type in NEW_EVENT_TYPES:
            assert event_type in constraint_def

    def test_dispute_opened_inserts_and_appears_in_timeline(self, db):
        _insert_event(db, "dispute_opened", "2026-07-19T10:00:00Z")
        assert "dispute_opened" in _timeline(db)

    def test_dispute_resolved_inserts_and_appears_in_timeline(self, db):
        _insert_event(db, "dispute_resolved", "2026-07-19T10:01:00Z")
        assert "dispute_resolved" in _timeline(db)

    def test_paid_offplatform_inserts_and_appears_in_timeline(self, db):
        _insert_event(db, "paid_offplatform", "2026-07-19T10:02:00Z")
        assert "paid_offplatform" in _timeline(db)

    def test_timeline_orders_all_new_events_by_created_at(self, db):
        assert _timeline(db) == [
            "dispute_opened",
            "dispute_resolved",
            "paid_offplatform",
        ]

    def test_original_event_types_still_accepted(self, db):
        _insert_event(db, "arrived", "2026-07-19T09:00:00Z")
        assert _timeline(db)[0] == "arrived"

    def test_unknown_event_type_still_rejected(self, db):
        with pytest.raises(errors.CheckViolation):
            _insert_event(db, "definitely_not_an_event")
