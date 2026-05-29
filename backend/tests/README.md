# SwingBy Backend Tests

## Overview

Test suite for SwingBy backend covering authentication, businesses, bookings, payments, reviews, and smoke tests.

## Structure

```
backend/tests/
├── __init__.py                    # Package marker
├── conftest.py                    # Pytest fixtures (test_client, httpx_client)
├── test_auth.py                   # POST /auth/signup, /login, GET /auth/me
├── test_businesses.py             # /businesses CRUD, /businesses/nearby, pagination
├── test_booking_flow.py           # End-to-end booking workflow (signup → complete → review)
├── test_payments.py               # Escrow math, payment transactions
├── test_reviews.py                # Create review, list, rating aggregation
├── test_migrations.py             # SQL syntax validation (docs/*.sql)
├── test_smoke_prod.py             # Deployed Render API (smoke tests, marked @pytest.mark.smoke)
└── k6/
    └── nearby_load.js             # Load test for /businesses/nearby (100 RPS, 60s)
```

## Running Tests

### Install dependencies

```bash
pip install -r requirements-dev.txt
```

### Run all unit tests

```bash
pytest backend/tests/
```

### Run a specific test file

```bash
pytest backend/tests/test_auth.py
```

### Run tests with verbose output

```bash
pytest -v backend/tests/
```

### Run only smoke tests (Render deployment)

```bash
pytest -m smoke backend/tests/test_smoke_prod.py
```

### Skip smoke tests (default in CI)

```bash
pytest -m "not smoke" backend/tests/
```

### Run with custom Render URL

```bash
RENDER_URL=https://custom-url.onrender.com pytest -m smoke backend/tests/test_smoke_prod.py
```

## Test Categories

### Unit Tests (T81–T85)

| Test | Coverage | Status |
|------|----------|--------|
| **test_auth.py** (T81) | 8+ tests: signup, login, brute-force lockout, /me | Scaffold |
| **test_businesses.py** (T82) | 5+ tests: create, list, nearby, update, pagination | Scaffold |
| **test_booking_flow.py** (T83) | End-to-end: signup → complete → review | Scaffold |
| **test_payments.py** (T84) | Escrow math: 50% confirm, 50%-10% complete, penalties | Logic tests (no HTTP) |
| **test_reviews.py** (T85) | Create, list, rating aggregation | Scaffold |

### Smoke & Integration Tests (T86, T89)

| Test | Coverage | Status |
|------|----------|--------|
| **test_smoke_prod.py** (T86) | /healthz, /health, /docs on Render | Requires RENDER_URL |
| **test_migrations.py** (T89) | SQL syntax validation (docs/*.sql) | Skipped (requires sqlparse/psycopg2) |

### Load Testing (T87)

| Test | Coverage | Target |
|------|----------|--------|
| **k6/nearby_load.js** | GET /businesses/nearby | 100 RPS, p95<1500ms, <5% errors |

**To run load test:**

```bash
k6 run backend/tests/k6/nearby_load.js
```

Or with custom URL:

```bash
k6 run -e BASE_URL=http://localhost:8000 backend/tests/k6/nearby_load.js
```

## Mocking

All tests use **unittest.mock** to stub Supabase calls. No live database required.

Example:

```python
with patch("app.api.auth.supabase") as mock_supabase:
    mock_supabase.auth.sign_up.return_value = ...
    response = test_client.post("/auth/signup", json={...})
```

## Mobile E2E Tests (T88)

Detox configuration and sample signup test (React Native).

- `.detoxrc.js` — Detox config (iOS sim + Android emulator)
- `e2e/jest.config.js` — Jest config for Detox
- `e2e/signup.e2e.js` — Signup flow test (scaffold)

**To run mobile E2E (requires Xcode/Android SDK):**

```bash
detox build-ios --configuration ios.sim.debug
detox test e2e/signup.e2e.js --configuration ios.sim.debug
```

## Skipped Tests

Some tests are marked with `@pytest.mark.skip` and include TODO comments:

- `test_migrations.py` — Requires sqlparse or psycopg2 integration
- `test_smoke_prod.py` — Skipped if `RENDER_URL` is not set

These can be enabled once dependencies are available.

## Notes

- Tests are **importable now** but do not require live infrastructure
- HTTP mocking via `unittest.mock.patch`
- Async tests use `pytest-asyncio` marker
- Load tests use **k6** (separate binary install)
- Mobile tests use **Detox** (requires device simulator setup)
