"""D13 — a misconfigured Stripe price id must not 500 every business owner.

`STRIPE_PRICE_TEAM` was set to `prod_Un0sRFGpiSHrL9` in Render: a Product id
where a Price id is required, and one that does not exist in the account at all.
All 18 businesses are team-tier, so every owner who tapped Subscribe — from
either of the two screens that reach it — got a 500. For weeks.

The endpoint already had the right behaviour for "billing is not configured":
flip to `trialing`, charge nothing, return a message. It just wasn't reached,
because a *malformed* price id took a different branch from a *missing* one.
These tests pin that the two are now the same branch.
"""

from unittest.mock import MagicMock, patch

import pytest


BIZ = {"id": "biz-1", "business_name": "Douglas Glen Cleaning Co."}
OWNER = {"id": "owner-1", "role": "business_owner", "email": "biz@swingby.dev"}


@pytest.fixture
def subscribe_call():
    """Call subscribe() with the DB stubbed and a chosen price-id env."""

    def _call(price_env: dict, active_employees: int = 2):
        from app.api import subscriptions

        emp_res = MagicMock()
        emp_res.count = active_employees

        table = MagicMock()
        table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            emp_res
        )
        table.update.return_value.eq.return_value.execute.return_value = MagicMock()

        with patch.object(subscriptions, "supabase") as sb, patch.object(
            subscriptions, "_get_owner_business", return_value=BIZ
        ), patch.dict("os.environ", price_env, clear=False):
            sb.table.return_value = table
            return subscriptions.subscribe(current_user=OWNER)

    return _call


def test_a_product_id_falls_back_to_track_only(subscribe_call):
    """The exact value that was live in Render."""
    out = subscribe_call({"STRIPE_PRICE_TEAM": "prod_Un0sRFGpiSHrL9"})
    assert out["status"] == "trialing"
    assert out["checkout_url"] is None
    assert out["tier"] == "team"


@pytest.mark.parametrize(
    "bad",
    [
        "prod_Un0sRFGpiSHrL9",  # a Product id
        "sub_123",  # a Subscription id
        "price",  # truncated
        "PRICE_123",  # wrong case — Stripe ids are lowercase-prefixed
        "not-an-id-at-all",
    ],
)
def test_anything_that_is_not_a_price_id_degrades(subscribe_call, bad):
    """A Product id was just the shape we happened to ship. Any unusable value
    means 'billing is not configured', which is what the fallback is for."""
    out = subscribe_call({"STRIPE_PRICE_TEAM": bad})
    assert out["status"] == "trialing"


def test_a_missing_price_id_still_degrades(subscribe_call):
    """The pre-existing behaviour, unchanged — this is the branch we joined."""
    out = subscribe_call({"STRIPE_PRICE_TEAM": ""})
    assert out["status"] == "trialing"


def test_the_misconfiguration_is_still_loud_in_the_logs(subscribe_call, caplog):
    """Degrading quietly for the USER must not mean degrading silently for the
    operator — that is how a config error survives to launch."""
    import logging

    with caplog.at_level(logging.ERROR):
        subscribe_call({"STRIPE_PRICE_TEAM": "prod_Un0sRFGpiSHrL9"})

    # getMessage() already applies the args — do not interpolate a second time.
    joined = " ".join(r.getMessage() for r in caplog.records)
    assert "STRIPE_PRICE_TEAM" in joined
    assert "prod_Un0sRFGpiSHrL9" in joined


def test_a_real_price_id_is_not_swallowed(subscribe_call):
    """The guard must not eat a valid configuration. With a real price_... id we
    should reach the Stripe branch — proven here by it failing on the absent
    API key rather than returning 'trialing'."""
    from fastapi import HTTPException

    with patch.dict("os.environ", {"STRIPE_SECRET_KEY": ""}, clear=False):
        with pytest.raises(HTTPException) as exc:
            subscribe_call({"STRIPE_PRICE_TEAM": "price_1AbcDEfGhIjKlMnO"})
    assert exc.value.status_code == 503


def test_a_solo_business_reads_the_solo_variable(subscribe_call):
    out = subscribe_call({"STRIPE_PRICE_SOLO": "prod_bogus"}, active_employees=0)
    assert out["tier"] == "solo"
    assert out["status"] == "trialing"
