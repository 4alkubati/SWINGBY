"""
test_area.py — the quadrant a job post shows to businesses deciding whether to
quote, before anyone is booked and before the street address is theirs to see.

Every address below is a real shape taken from the 77 live service_posts, not an
invented example — including the ones that must produce nothing.
"""

import pytest

from app.services.area import area_label, quadrant_for


class TestAbbreviated:
    """64 of 75 live addresses use the short form."""

    @pytest.mark.parametrize(
        "address,expected",
        [
            ("3823 16 St SW, Calgary, AB", "SW"),
            ("1236 8 Ave SE, Calgary, AB", "SE"),
            ("740 McDougall Rd NE, Calgary, AB", "NE"),
            ("1919 Kensington Rd NW Calgary AB", "NW"),
            ("512 9A St NW, Calgary, AB", "NW"),
            ("200 Barclay Parade SW, Calgary, AB", "SW"),
            ("143 Citadel Meadow Gardens NW", "NW"),
        ],
    )
    def test_reads_the_stated_quadrant(self, address, expected):
        assert quadrant_for(address) == expected


class TestSpelledOut:
    """
    The Google geocoder rewrites "NW" as "Northwest". Six live posts are in this
    form, and an earlier count that matched only the abbreviation missed all of
    them.
    """

    @pytest.mark.parametrize(
        "address,expected",
        [
            ("143 Citadel Meadow Gardens Northwest, Calgary, AB, Canada", "NW"),
            ("5005 Dalhousie Drive Northwest, Calgary, AB, Canada", "NW"),
            ("100 Main Street Southeast, Calgary, AB, Canada", "SE"),
            ("100 Main Street South East, Calgary, AB", "SE"),
        ],
    )
    def test_reads_the_spelled_form(self, address, expected):
        assert quadrant_for(address) == expected


class TestSaysNothingRatherThanGuessing:
    """
    The failure that matters is not a missing label — it is a WRONG one. A
    business that drives to the wrong side of Calgary does not trust the field
    again.
    """

    @pytest.mark.parametrize(
        "address",
        [
            "Calgary, AB",
            "143 citadel meado gardens",
            None,
            "",
            "   ",
        ],
    )
    def test_no_quadrant_means_none(self, address):
        assert quadrant_for(address) is None

    def test_a_bare_direction_is_not_a_quadrant(self):
        """
        "143 Fittons Road West" is a real post in the live data — in Orillia,
        Ontario. Treating a trailing "West" as a Calgary quadrant would place
        that job 3,000 km from where it is.
        """
        assert quadrant_for("143 Fittons Road West, Orillia, ON, Canada") is None
        assert quadrant_for("12 East Street, Calgary, AB") is None

    def test_street_names_containing_the_letters_are_not_matched(self):
        # "Nesbitt" and "Swenson" contain NE and SW as substrings.
        assert quadrant_for("14 Nesbitt Place, Calgary, AB") is None
        assert quadrant_for("9 Swenson Crescent, Calgary") is None

    def test_the_designation_wins_over_a_name_fragment(self):
        # A street name that IS a direction word, followed by the real quadrant.
        assert quadrant_for("55 Northmount Drive NW, Calgary, AB") == "NW"
        assert quadrant_for("1 Southland Drive SE, Calgary, AB") == "SE"


class TestLabel:
    def test_label_matches_the_quadrant(self):
        assert area_label("3823 16 St SW, Calgary, AB") == "SW"

    def test_label_is_none_when_unknown(self):
        assert area_label("Calgary, AB") is None


class TestAreaSurvivesMasking:
    """
    The point of the whole feature: a business browsing the feed sees the
    quadrant, and still sees nothing that identifies the client.

    mask_address_to_locality keeps everything AFTER the first comma, and the
    quadrant sits before it — so masking used to discard the one piece of
    geography a business needs, and every post looked equally far away.
    """

    def test_quadrant_survives_a_full_address(self):
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row({"address": "3823 16 St SW, Calgary, AB"})
        assert masked["area"] == "SW"
        assert masked["address"] == "Calgary, AB"
        assert "16 St" not in str(masked)  # the street is still gone

    def test_quadrant_survives_the_fail_closed_path(self):
        """
        A comma-less address masks to None — correctly, because there is no way
        to tell a bare city from a free-typed street address by shape. The
        client still gets their quadrant, which is what gets them quotes.
        """
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row({"address": "143 Citadel Meadow Gardens NW"})
        assert masked["address"] is None
        assert masked["area"] == "NW"

    def test_no_quadrant_is_not_invented(self):
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row({"address": "Calgary, AB"})
        assert masked["area"] is None

    def test_out_of_town_posts_get_no_calgary_quadrant(self):
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row(
            {"address": "143 Fittons Road West, Orillia, ON, Canada"}
        )
        assert masked["area"] is None
        assert masked["address"] == "Orillia, ON, Canada"
