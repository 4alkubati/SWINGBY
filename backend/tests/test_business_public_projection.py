"""
test_business_public_projection.py — SB-0014: a business row is not a public
document, and four read paths were handing back all 33 columns of it.

`GET /businesses/nearby`, `GET /businesses/`, `GET /businesses/{id}` and the
work-history search each did `select("*")` and returned the row spread
verbatim. Any signed-up client could page `GET /businesses/?limit=100` and
harvest, for every business on the platform: its Stripe Connect account id,
Stripe customer id, subscription id / status / price id / period end,
`connect_requirements_due` (which spells out what Stripe is still missing from
that business), and the licence number.

The guard is an ALLOWLIST, deliberately. A blocklist of "drop the stripe_ ones"
passes today and leaks the next sensitive column somebody adds — and this table
has grown from 10 columns to 33. Anything not named public is dropped, so a new
column is private until someone decides otherwise.

`GET /businesses/me` is excluded on purpose: that is the owner reading their own
row, and the payout/subscription fields are exactly what that screen renders.
"""

import pytest

from app.api import businesses


# Every column that is not a public property of a business, from the live
# schema at the time of filing.
SENSITIVE_COLUMNS = [
    "license_number",
    "stripe_customer_id",
    "stripe_connect_account_id",
    "subscription_id",
    "subscription_price_id",
    "subscription_status",
    "subscription_tier",
    "subscription_started_at",
    "subscription_current_period_end",
    "subscription_cancel_at",
    "payouts_enabled",
    "connect_charges_enabled",
    "connect_details_submitted",
    "connect_disabled_reason",
    "connect_requirements_due",
    "connect_synced_at",
]

# What a client genuinely needs to render a business card / profile.
EXPECTED_PUBLIC = [
    "id",
    "owner_id",
    "business_name",
    "category",
    "custom_category",
    "description",
    "license_status",
    "lat",
    "lng",
    "service_radius_km",
    "avg_rating",
    "review_count",
    "address",
    "logo_url",
    "created_at",
]


def full_row():
    row = {name: f"secret-{name}" for name in SENSITIVE_COLUMNS}
    row.update(
        {
            "id": "biz-1",
            "owner_id": "user-1",
            "business_name": "Douglas Glen Cleaning Co.",
            "category": "cleaning",
            "custom_category": None,
            "description": "We clean things.",
            "license_status": "verified",
            "lat": 51.0,
            "lng": -114.0,
            "service_radius_km": 25,
            "avg_rating": 4.8,
            "review_count": 12,
            "address": "Calgary, AB",
            "logo_url": "https://x.supabase.co/logo.png",
            "created_at": "2026-01-01T00:00:00Z",
            "geocoded_at": "2026-01-01T00:00:00Z",
            "geocode_source": "google",
        }
    )
    return row


class TestProjection:
    @pytest.mark.parametrize("column", SENSITIVE_COLUMNS)
    def test_sensitive_columns_never_survive(self, column):
        out = businesses._public_business(full_row())
        assert column not in out, (
            f"{column} reached a client through a public business read (SB-0014)"
        )

    @pytest.mark.parametrize("column", EXPECTED_PUBLIC)
    def test_public_columns_do_survive(self, column):
        """The card still has to render — this is not a fix if it breaks the app."""
        assert column in businesses._public_business(full_row())

    def test_unknown_columns_are_dropped_not_passed_through(self):
        """
        Allowlist, not blocklist: the next sensitive column added to this table
        must be private by default.
        """
        row = full_row()
        row["stripe_some_future_secret"] = "nope"
        assert "stripe_some_future_secret" not in businesses._public_business(row)

    def test_computed_extras_are_preserved(self):
        """
        distance_km / completed_bookings / rank metadata are added by the route
        after the row is read, and must ride along.
        """
        out = businesses._public_business(
            {**full_row(), "distance_km": 3.2, "completed_bookings": 7, "is_employee": True}
        )
        assert out["distance_km"] == 3.2
        assert out["completed_bookings"] == 7
        assert out["is_employee"] is True

    def test_logo_key_is_still_guaranteed(self):
        """
        `_with_logo_key` pins logo_url to None when the column is unapplied so
        the response shape does not flicker with migration state. The
        projection must not undo that.
        """
        row = full_row()
        del row["logo_url"]
        assert businesses._public_business(row)["logo_url"] is None


class TestReadPathsUseIt:
    """
    Guards the actual regression: one of the four paths being missed, which is
    how this finding came to exist in the first place.
    """

    @pytest.mark.parametrize(
        "func_name",
        ["get_nearby_businesses", "list_businesses", "get_business", "_search_by_work"],
    )
    def test_route_projects_before_returning(self, func_name):
        import inspect

        func = None
        for name, obj in vars(businesses).items():
            if name == func_name and callable(obj):
                func = obj
                break
        if func is None:
            pytest.skip(f"{func_name} not found — route renamed?")
        src = inspect.getsource(func)
        assert "_public_business" in src, (
            f"{func_name} returns business rows without projecting them (SB-0014)"
        )
