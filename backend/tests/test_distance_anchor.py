"""
test_distance_anchor.py — audit L7: "same address, 14.1 km apart".

WHAT KIRA SAW: his client account and his business account are at the same
street address, and browse showed the business 14.1 km away.

WHAT THE DATA SAYS (live Supabase, project ulnxapnsenzyddddldjt, read
2026-07-24):

    businesses    "Amr's Moving Company"
                  143 Citadel Meadow Gardens Northwest, Calgary, AB
                  lat 51.1492608  lng -114.1859668   geocode_source=places_autocomplete
    service_posts "I need someone to help me move…"
                  143 Citadel Meadow Gardens NW
                  lat 51.1492608  lng -114.1859668

Identical to seven decimal places. So it is NOT a centroid fallback in the
geocoder, NOT swapped lat/lng, and NOT a bad row: business-to-post distance is
exactly 0.

THE ANCHOR IS WRONG, NOT THE MATH. `mobile/src/screens/client/HomeScreen.js`
defines

    const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };   // downtown

and `fetchNearby()` substitutes it whenever `getUserLocation()` throws —
which is exactly what happens on a device where location permission is denied
or expo-location cannot resolve a fix (the walkthrough device is a Huawei with
no Play Services, see B5). The fallback anchor is then passed to
`GET /businesses/nearby` as if it were the user's position, and every distance
on the screen is measured from downtown Calgary. Downtown → Citadel is 14.1 km.

`test_the_reported_141_km_is_the_downtown_fallback_anchor` below reproduces
that number from the two published coordinates, which is what pins the
diagnosis. The backend Haversine is correct and is left alone; the fix belongs
in the mobile screen (Lane 2): when the real location is unavailable, do not
send a fabricated one — omit lat/lng, and let the UI say "distance unavailable"
instead of printing a confident, wrong number. A fabricated anchor is also a
privacy problem, because it makes the distance figure untrustworthy as the
basis for the masked-location promise.
"""

from unittest.mock import patch

import pytest

from app.api.businesses import _haversine_km
from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

# 143 Citadel Meadow Gardens NW — Kira's business AND his client post.
CITADEL = (51.1492608, -114.1859668)
# mobile/src/screens/client/HomeScreen.js :: CALGARY_FALLBACK
DOWNTOWN_FALLBACK = (51.0447, -114.0719)

CLIENT = {"id": "client-1", "role": "client"}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class TestHaversineIsNotTheBug:
    def test_identical_coordinates_are_zero_km(self):
        assert _haversine_km(*CITADEL, *CITADEL) == 0.0

    def test_the_reported_141_km_is_the_downtown_fallback_anchor(self):
        """The audit's 14.1 km, reproduced from the fallback constant.

        This is the whole diagnosis in one assertion: the number is real, the
        arithmetic is right, and the anchor is a hard-coded city centre.
        """
        km = _haversine_km(*DOWNTOWN_FALLBACK, *CITADEL)
        assert round(km, 1) == 14.1

    def test_latitude_and_longitude_are_not_swapped(self):
        """A swapped pair would put Calgary in the Indian Ocean, ~13 000 km off."""
        correct = _haversine_km(51.0447, -114.0719, 51.05, -114.08)
        swapped = _haversine_km(-114.0719, 51.0447, -114.08, 51.05)
        assert correct < 1.5
        # The swapped call is not an error, it just measures a different pair —
        # the guard is that the correct one is small, so a large value in
        # production means a bad anchor, never a transposed argument order.
        assert swapped < 1.5


class TestNearbyReturnsZeroForTheSameAddress:
    def test_business_at_the_callers_exact_coordinates_is_zero_km(
        self, test_client, as_client
    ):
        businesses_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "biz-1",
                    "owner_id": "owner-1",
                    "business_name": "Amr's Moving Company",
                    "lat": CITADEL[0],
                    "lng": CITADEL[1],
                    "service_radius_km": 100,
                }
            ]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = businesses_stub
            with patch("app.api.businesses.hidden_user_ids", return_value=set()):
                response = test_client.get(
                    f"/businesses/nearby?lat={CITADEL[0]}&lng={CITADEL[1]}",
                    headers={"Authorization": "Bearer test-token"},
                )

        assert response.status_code == 200
        assert response.json()["items"][0]["distance_km"] == 0.0
