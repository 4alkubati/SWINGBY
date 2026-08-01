"""SQLAlchemy scaffolding — present, and deliberately not load-bearing.

NOTHING IN THIS APPLICATION QUERIES POSTGRES DIRECTLY. Every read and write goes
through PostgREST via `supabase_client.supabase`. `get_db` has no callers, and
`engine` had exactly one: the /health probe — which was therefore reporting the
reachability of a connection the app never opens. Green while PostgREST was
down, red while everything worked. That probe asks Supabase now (see main.py).

So `DATABASE_URL` is optional. It used to be REQUIRED at import (config.py) and
`create_engine(None)` used to raise right here, which meant a correctly
configured deployment — Supabase keys set, everything the app actually needs —
could refuse to boot over a connection string it would never open.

Kept rather than deleted because migrations and one-off scripts may still want a
real connection. With `DATABASE_URL` unset, `engine` is None and asking for a
session says so plainly instead of dying on `NoneType`.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or None

engine = create_engine(DATABASE_URL) if DATABASE_URL else None
SessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None
)
Base = declarative_base()


def get_db():
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not set, so there is no direct Postgres session. "
            "This application uses PostgREST (app.supabase_client.supabase); "
            "set DATABASE_URL only if you genuinely need raw SQL."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
