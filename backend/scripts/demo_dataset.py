"""
demo_dataset.py — the fictional Calgary marketplace used for investor demos.

Everything in here is INVENTED. No real business, person, address or phone
number is used (all phone numbers are in the 555 fictional-use block).

Design rules that make the seed safe to run against the live database:

1.  Every row id is DETERMINISTIC — uuid5 over a fixed namespace — so running
    the seeder twice updates the same rows instead of creating duplicates,
    and the teardown can target the exact ids that were created.
2.  Every seeded auth/user account lives on the `demo.swingbyy.com` email
    domain. That domain is the ownership marker: the teardown refuses to
    delete a user whose email is not on it.
3.  Column names here were diffed against `information_schema.columns` on
    project ulnxapnsenzyddddldjt on 2026-07-23. Traps that bit previous
    agents and are deliberately handled:
      - `users` has first_name/last_name, NOT `name`
      - `bookings` has NO scheduled_date and NO completed_at
        (dates live in proposed_date_1..3 / confirmed_date)
      - `payments` has NO `notes`
      - `service_posts` has BOTH `preffered_date` (typo, unused) and
        `preferred_date` — we only ever write `preferred_date`
      - `bookings.post_id` is UNIQUE — one booking per post, max
    CHECK constraints honoured:
      - bookings.status        ∈ confirmed | in_progress | completed | cancelled
      - bookings.payment_status ∈ pending_payment | failed | held |
                                  partial_released | fully_released |
                                  refunded | paid_off_platform
      - booking_events.event_type ∈ dates_proposed | date_confirmed | en_route |
                                  arrived | started | paused | resumed |
                                  completed | cancelled_event | dispute_opened |
                                  dispute_resolved | paid_offplatform
      - payments.status/method, reviews.reviewee_type, reviews.rating 1..5,
        service_posts.status, service_posts.geocode_source,
        businesses.license_status / subscription_* — all checked.
    Categories are the canonical labels from backend/app/categories.py so the
    mobile category chips (which send lowercase) match via ilike.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

# ── identity ────────────────────────────────────────────────────────────────
# NOTE: NOT a .test / .invalid / .example domain. The API validates every
# login with pydantic EmailStr, which rejects RFC-2606 special-use TLDs
# outright ("the part after the @-sign is a special-use or reserved name")
# — demo accounts on such a domain exist in the database but can never
# log in. Verified against production on 2026-07-23 (HTTP 422).
# This subdomain of the founder's own domain has no mail records and is
# used only as a namespace marker.
SEED_DOMAIN = "demo.swingbyy.com"
SEED_TAG = "swingby-demo-seed-v1"
_NS = uuid.uuid5(uuid.NAMESPACE_URL, f"https://swingby.app/{SEED_TAG}")


def did(kind: str, slug: str) -> str:
    """Deterministic id for a seeded row."""
    return str(uuid.uuid5(_NS, f"{kind}:{slug}"))


def _email(slug: str) -> str:
    return f"{slug}@{SEED_DOMAIN}"


# ── people ──────────────────────────────────────────────────────────────────
# (slug, first, last, phone)
OWNERS = [
    ("marisol-vega", "Marisol", "Vega", "+1-587-555-0142"),
    ("tomas-ferreira", "Tomas", "Ferreira", "+1-587-555-0118"),
    ("priya-raghunathan", "Priya", "Raghunathan", "+1-403-555-0193"),
    ("declan-orourke", "Declan", "O'Rourke", "+1-403-555-0177"),
    ("yusuf-barre", "Yusuf", "Barre", "+1-587-555-0164"),
    ("hana-kobayashi", "Hana", "Kobayashi", "+1-403-555-0125"),
    ("grant-whitlock", "Grant", "Whitlock", "+1-587-555-0136"),
    ("nadia-osei", "Nadia", "Osei", "+1-403-555-0158"),
    ("rasheed-malik", "Rasheed", "Malik", "+1-587-555-0171"),
    ("erin-kowalchuk", "Erin", "Kowalchuk", "+1-403-555-0149"),
    ("vincent-trang", "Vincent", "Trang", "+1-587-555-0186"),
    ("sofia-bertrand", "Sofia", "Bertrand", "+1-403-555-0110"),
    ("malik-johansen", "Malik", "Johansen", "+1-587-555-0197"),
    ("chloe-devereaux", "Chloe", "Devereaux", "+1-403-555-0132"),
    ("omar-haddad", "Omar", "Haddad", "+1-587-555-0121"),
]

CLIENTS = [
    ("nadia-whitfield", "Nadia", "Whitfield", "+1-587-555-0203"),
    ("peter-lindqvist", "Peter", "Lindqvist", "+1-403-555-0211"),
    ("amara-nwosu", "Amara", "Nwosu", "+1-587-555-0228"),
    ("josh-beaumont", "Josh", "Beaumont", "+1-403-555-0234"),
    ("renee-cartier", "Renee", "Cartier", "+1-587-555-0247"),
    ("ibrahim-kante", "Ibrahim", "Kante", "+1-403-555-0259"),
]

# ── businesses ──────────────────────────────────────────────────────────────
# (owner_slug, name, category, custom_category, neighbourhood, lat, lng,
#  radius_km, rating, review_count, blurb)
BUSINESSES = [
    (
        "marisol-vega",
        "Bow Ridge Lawn & Yard",
        "Landscaping",
        "Lawn care",
        "Marda Loop",
        51.0186,
        -114.1002,
        20,
        4.8,
        96,
        "Weekly lawn cutting, spring cleanups and hedge trimming across the "
        "southwest. Two-person crews, same-day quotes.",
    ),
    (
        "tomas-ferreira",
        "Beltline Shine Cleaning",
        "Cleaning",
        None,
        "Beltline",
        51.0402,
        -114.0790,
        18,
        4.9,
        141,
        "Condo and apartment cleaning in the core. Move-out deep cleans, "
        "eco-friendly products, bring our own supplies.",
    ),
    (
        "priya-raghunathan",
        "Kensington Tap & Drain",
        "Plumbing",
        None,
        "Kensington",
        51.0538,
        -114.0900,
        25,
        4.7,
        74,
        "Licensed plumbers for leaks, clogged drains, water heaters and "
        "faucet swaps. Upfront pricing before any work starts.",
    ),
    (
        "declan-orourke",
        "Inglewood Current Electric",
        "Electrical",
        None,
        "Inglewood",
        51.0405,
        -114.0300,
        30,
        4.6,
        58,
        "Panel upgrades, EV charger installs, pot lights and troubleshooting. "
        "Journeyman electrician, permits pulled for every job.",
    ),
    (
        "yusuf-barre",
        "Bridgeland Brushworks",
        "Painting",
        None,
        "Bridgeland",
        51.0530,
        -114.0430,
        22,
        4.9,
        63,
        "Interior repaints, feature walls and cabinet refinishing. Clean edges, "
        "drop sheets everywhere, furniture back where it started.",
    ),
    (
        "hana-kobayashi",
        "Mission Fix-It Collective",
        "Handyman",
        None,
        "Mission",
        51.0330,
        -114.0700,
        20,
        4.8,
        112,
        "The small-jobs list nobody else will take: shelves, door hinges, "
        "drywall patches, IKEA assembly, picture walls.",
    ),
    (
        "grant-whitlock",
        "Hillhurst Snow & Ice",
        "Landscaping",
        "Snow removal",
        "Hillhurst",
        51.0570,
        -114.0980,
        25,
        4.5,
        87,
        "Driveway and walkway clearing within 6 hours of snowfall. Seasonal "
        "contracts and one-off digs after a dump.",
    ),
    (
        "nadia-osei",
        "Altadore Deep Clean",
        "Cleaning",
        None,
        "Altadore",
        51.0110,
        -114.1030,
        20,
        5.0,
        39,
        "Detail-first house cleaning: baseboards, inside ovens, window tracks. "
        "Same cleaner every visit.",
    ),
    (
        "rasheed-malik",
        "Renfrew Rooter Plumbing",
        "Plumbing",
        None,
        "Renfrew",
        51.0600,
        -114.0400,
        28,
        4.4,
        51,
        "Drain camera inspections, root cutting and emergency shut-offs. "
        "Evenings and weekends at no extra call-out fee.",
    ),
    (
        "erin-kowalchuk",
        "Signal Hill Handy Crew",
        "Handyman",
        None,
        "Signal Hill",
        51.0300,
        -114.1800,
        25,
        4.7,
        68,
        "Fence repairs, deck boards, garage shelving and door adjustments "
        "across the west side.",
    ),
    (
        "vincent-trang",
        "McKenzie Movers",
        "Moving",
        None,
        "McKenzie Towne",
        50.8900,
        -113.9500,
        40,
        4.6,
        124,
        "Two movers and a 20-foot truck. Apartments, condos and small houses, "
        "hourly rate with blankets and dollies included.",
    ),
    (
        "sofia-bertrand",
        "Auburn Bay Yardworks",
        "Landscaping",
        "Lawn care",
        "Auburn Bay",
        50.8850,
        -113.9450,
        22,
        4.8,
        45,
        "Sod repair, mulch, garden beds and irrigation blowouts in the deep "
        "south communities.",
    ),
    (
        "malik-johansen",
        "Tuscany Timber Carpentry",
        "Carpentry",
        None,
        "Tuscany",
        51.1300,
        -114.2400,
        30,
        4.9,
        33,
        "Custom shelving, trim work, closet builds and deck framing. Shop "
        "drawings before we cut anything.",
    ),
    (
        "chloe-devereaux",
        "Cranston Coat & Colour",
        "Painting",
        None,
        "Cranston",
        50.8800,
        -114.0000,
        25,
        4.7,
        57,
        "Exterior and interior painting with colour consults included. Low-VOC "
        "paint, tidy site, no overspray.",
    ),
    (
        "omar-haddad",
        "Sunnyside Spark Electric",
        "Electrical",
        None,
        "Sunnyside",
        51.0570,
        -114.0740,
        25,
        4.8,
        79,
        "Lighting, outlets, smoke alarms and small commercial fit-ups in the "
        "inner city. Certified and insured.",
    ),
]

# ── open job posts (client side of the marketplace) ─────────────────────────
# (slug, client_slug, title, category, budget, address, lat, lng, days_ago,
#  preferred_in_days, description)
POSTS = [
    (
        "post-beltline-condo-clean",
        "nadia-whitfield",
        "Move-out clean for a 1-bed condo",
        "Cleaning",
        220.0,
        "1204 12 Ave SW, Calgary, AB",
        51.0398,
        -114.0855,
        2,
        5,
        "Leaving a 1-bedroom in the Beltline on the 30th. Needs oven, fridge "
        "and bathroom done properly for the walkthrough.",
    ),
    (
        "post-hillhurst-fence",
        "peter-lindqvist",
        "Two fence panels blew down",
        "Handyman",
        340.0,
        "512 9A St NW, Calgary, AB",
        51.0561,
        -114.0912,
        4,
        3,
        "Back fence lost two panels in the wind. Posts look fine. Need them "
        "re-hung and one rail replaced.",
    ),
    (
        "post-inglewood-kitchen-tap",
        "amara-nwosu",
        "Kitchen tap dripping constantly",
        "Plumbing",
        180.0,
        "1420 9 Ave SE, Calgary, AB",
        51.0392,
        -114.0310,
        1,
        2,
        "Single-lever kitchen tap drips even when off. Happy to replace the "
        "cartridge or the whole tap, whichever is smarter.",
    ),
    (
        "post-mckenzie-move",
        "josh-beaumont",
        "Small 2-bedroom move within McKenzie Towne",
        "Moving",
        620.0,
        "88 McKenzie Towne Dr SE, Calgary, AB",
        50.8895,
        -113.9482,
        3,
        9,
        "Moving five blocks. Two bedrooms, no piano, one flight of stairs at "
        "the new place. Boxes already packed.",
    ),
    (
        "post-marda-loop-lawn",
        "renee-cartier",
        "Weekly lawn cut for the summer",
        "Landscaping",
        55.0,
        "2028 33 Ave SW, Calgary, AB",
        51.0181,
        -114.0988,
        6,
        4,
        "Small front and back lawn, about 2,000 sq ft total. Looking for the "
        "same person every week until September.",
    ),
    (
        "post-bridgeland-bedroom-paint",
        "ibrahim-kante",
        "Repaint two bedrooms",
        "Painting",
        780.0,
        "740 McDougall Rd NE, Calgary, AB",
        51.0522,
        -114.0448,
        5,
        11,
        "Two bedrooms, walls and ceilings, currently dark blue going to warm "
        "white. Furniture can be moved to the middle.",
    ),
    (
        "post-signal-hill-lights",
        "nadia-whitfield",
        "Six pot lights in the basement",
        "Electrical",
        900.0,
        "112 Sienna Park Green SW, Calgary, AB",
        51.0312,
        -114.1786,
        7,
        13,
        "Finished basement, drop ceiling in half of it. Want dimmable pot "
        "lights and one new switch.",
    ),
    (
        "post-auburn-bay-shelving",
        "peter-lindqvist",
        "Garage shelving build",
        "Carpentry",
        480.0,
        "155 Auburn Bay Blvd SE, Calgary, AB",
        50.8861,
        -113.9438,
        8,
        6,
        "Want a wall of sturdy shelves along one side of a double garage. "
        "Plywood and 2x4 is fine, just needs to hold bins.",
    ),
    (
        "post-renfrew-drain",
        "amara-nwosu",
        "Basement floor drain backing up",
        "Plumbing",
        400.0,
        "823 Radford Rd NE, Calgary, AB",
        50.9997,
        -114.0392,
        1,
        1,
        "Water comes up the floor drain when the washing machine empties. "
        "House is 1960s so I expect roots.",
    ),
    (
        "post-mission-shelves",
        "josh-beaumont",
        "Mount a TV and two floating shelves",
        "Handyman",
        160.0,
        "2116 4 St SW, Calgary, AB",
        51.0308,
        -114.0724,
        2,
        4,
        "Brick-veneer wall in a condo. TV is 55 inch, mount is already here. "
        "Two shelves either side.",
    ),
    # ── screenshot set, added 2026-08-05 ────────────────────────────────────
    # The open-jobs feed auto-filters to the viewing business's OWN category,
    # so a category with one open post gives that owner a one-card screen.
    # Cleaning had exactly that problem. These spread open posts across the
    # categories the demo businesses actually work in, so whichever account is
    # used for the business-side screenshots opens on a populated feed.
    (
        "post-hillhurst-movein-clean",
        "renee-cartier",
        "Move-in clean before we take possession",
        "Cleaning",
        260.0,
        "1815 Kensington Rd NW, Calgary, AB",
        51.0551,
        -114.0937,
        1,
        6,
        "Three bedrooms, empty house. Want cupboards, oven and bathrooms done "
        "before the furniture arrives on the Saturday.",
    ),
    (
        "post-altadore-biweekly-clean",
        "josh-beaumont",
        "Bi-weekly cleaning for a 3-bed house",
        "Cleaning",
        175.0,
        "3823 16 St SW, Calgary, AB",
        51.0125,
        -114.0958,
        3,
        8,
        "Looking for someone regular, every second Friday. Two adults, one "
        "dog, no kids. Main floor and two bathrooms.",
    ),
    (
        "post-inglewood-panel",
        "peter-lindqvist",
        "Panel upgrade quote for a 1962 bungalow",
        "Electrical",
        2200.0,
        "1236 8 Ave SE, Calgary, AB",
        51.0398,
        -114.0287,
        2,
        14,
        "Still on 60 amp. Want a quote to go to 200 amp, permit included. "
        "Adding an EV charger later so size it for that.",
    ),
    (
        "post-marda-hedge",
        "ibrahim-kante",
        "Hedge trimming and one small tree removal",
        "Landscaping",
        340.0,
        "2440 34 Ave SW, Calgary, AB",
        51.0166,
        -114.1041,
        4,
        5,
        "Cedar hedge along the back fence has gotten away from us, plus a "
        "dead mountain ash about 12 feet that needs to come out.",
    ),
    (
        "post-bridgeland-deck-stain",
        "amara-nwosu",
        "Sand and re-stain a back deck",
        "Painting",
        620.0,
        "620 1 Ave NE, Calgary, AB",
        51.0511,
        -114.0462,
        5,
        10,
        "About 300 sq ft of deck plus the railing. Last done four years ago "
        "and it is going grey. Happy to pick the stain colour with you.",
    ),
]

# ── bookings ────────────────────────────────────────────────────────────────
# (slug, client_slug, business_slug, post_slug|None, category, amount,
#  status, payment_status, created_days_ago, confirmed_in_days)
#   confirmed_in_days: negative = in the past (job already happened)
BOOKINGS = [
    (
        "bk-beltline-deepclean",
        "nadia-whitfield",
        "tomas-ferreira",
        None,
        "Cleaning",
        245.0,
        "completed",
        "fully_released",
        26,
        -24,
    ),
    (
        "bk-kensington-heater",
        "nadia-whitfield",
        "priya-raghunathan",
        None,
        "Plumbing",
        410.0,
        "completed",
        "fully_released",
        19,
        -17,
    ),
    (
        "bk-marda-lawn",
        "renee-cartier",
        "marisol-vega",
        "post-marda-loop-lawn",
        "Landscaping",
        65.0,
        "completed",
        "fully_released",
        12,
        -10,
    ),
    (
        "bk-bridgeland-paint",
        "ibrahim-kante",
        "yusuf-barre",
        "post-bridgeland-bedroom-paint",
        "Painting",
        820.0,
        "completed",
        "fully_released",
        9,
        -7,
    ),
    (
        "bk-mission-handyman",
        "josh-beaumont",
        "hana-kobayashi",
        "post-mission-shelves",
        "Handyman",
        175.0,
        "completed",
        "fully_released",
        6,
        -5,
    ),
    (
        "bk-inglewood-tap",
        "amara-nwosu",
        "declan-orourke",
        None,
        "Electrical",
        260.0,
        "completed",
        "fully_released",
        15,
        -13,
    ),
    (
        "bk-mckenzie-move",
        "josh-beaumont",
        "vincent-trang",
        "post-mckenzie-move",
        "Moving",
        640.0,
        "confirmed",
        "held",
        2,
        4,
    ),
    (
        "bk-altadore-clean",
        "nadia-whitfield",
        "nadia-osei",
        None,
        "Cleaning",
        190.0,
        "in_progress",
        "held",
        1,
        3,
    ),
    (
        "bk-hillhurst-fence",
        "peter-lindqvist",
        "erin-kowalchuk",
        "post-hillhurst-fence",
        "Handyman",
        355.0,
        "in_progress",
        "held",
        1,
        0,
    ),
    # ── screenshot set, added 2026-08-05 ────────────────────────────────────
    # These exist so the APP STORE screenshots have something to photograph.
    # Two problems they fix, both found by querying the live database:
    #
    #   1. The demo client (Nadia) had no in-progress job, so the live-tracking
    #      screen — the best-looking screen in the app — was unreachable from
    #      the account the demo logs into. `bk-nadia-live-paint` is that job.
    #   2. Every business showed `review_count` in the 30-140 range while the
    #      reviews table held 8 rows in total, so a profile read "4.9 (63)"
    #      and then listed one review. reviews.booking_id is NOT NULL, so more
    #      reviews requires more completed bookings — hence the block below,
    #      spread across businesses and clients rather than piled on one.
    (
        "bk-nadia-live-paint",
        "nadia-whitfield",
        "yusuf-barre",
        None,
        "Painting",
        640.0,
        "in_progress",
        "held",
        1,
        0,
    ),
    (
        "bk-r1-beltline",
        "peter-lindqvist",
        "tomas-ferreira",
        None,
        "Cleaning",
        210.0,
        "completed",
        "fully_released",
        74,
        -72,
    ),
    (
        "bk-r2-beltline",
        "amara-nwosu",
        "tomas-ferreira",
        None,
        "Cleaning",
        265.0,
        "completed",
        "fully_released",
        48,
        -46,
    ),
    (
        "bk-r3-altadore",
        "josh-beaumont",
        "nadia-osei",
        None,
        "Cleaning",
        180.0,
        "completed",
        "fully_released",
        61,
        -59,
    ),
    (
        "bk-r4-altadore",
        "renee-cartier",
        "nadia-osei",
        None,
        "Cleaning",
        205.0,
        "completed",
        "fully_released",
        33,
        -31,
    ),
    (
        "bk-r5-kensington",
        "ibrahim-kante",
        "priya-raghunathan",
        None,
        "Plumbing",
        320.0,
        "completed",
        "fully_released",
        55,
        -53,
    ),
    (
        "bk-r6-kensington",
        "josh-beaumont",
        "priya-raghunathan",
        None,
        "Plumbing",
        195.0,
        "completed",
        "fully_released",
        28,
        -26,
    ),
    (
        "bk-r7-bridgeland",
        "renee-cartier",
        "yusuf-barre",
        None,
        "Painting",
        950.0,
        "completed",
        "fully_released",
        67,
        -65,
    ),
    (
        "bk-r8-bridgeland",
        "peter-lindqvist",
        "yusuf-barre",
        None,
        "Painting",
        540.0,
        "completed",
        "fully_released",
        41,
        -39,
    ),
    (
        "bk-r9-mission",
        "amara-nwosu",
        "hana-kobayashi",
        None,
        "Handyman",
        145.0,
        "completed",
        "fully_released",
        52,
        -50,
    ),
    (
        "bk-r10-mission",
        "ibrahim-kante",
        "hana-kobayashi",
        None,
        "Handyman",
        230.0,
        "completed",
        "fully_released",
        22,
        -20,
    ),
    (
        "bk-r11-mckenzie",
        "renee-cartier",
        "vincent-trang",
        None,
        "Moving",
        720.0,
        "completed",
        "fully_released",
        58,
        -56,
    ),
    (
        "bk-r12-marda",
        "amara-nwosu",
        "marisol-vega",
        None,
        "Landscaping",
        60.0,
        "completed",
        "fully_released",
        36,
        -34,
    ),
]

# ── reviews (client → business, plus a couple business → client) ────────────
# (booking_slug, rating, comment, direction)
REVIEWS = [
    (
        "bk-beltline-deepclean",
        5,
        "Left the condo cleaner than the day I moved in. Landlord signed off "
        "the walkthrough without a single note.",
        "business",
    ),
    (
        "bk-kensington-heater",
        5,
        "Diagnosed the water heater in ten minutes and had the part on the "
        "truck. Told me the price before touching anything.",
        "business",
    ),
    (
        "bk-marda-lawn",
        4,
        "Good cut and tidy edges. Showed up an hour later than the window but "
        "messaged me about it first.",
        "business",
    ),
    (
        "bk-bridgeland-paint",
        5,
        "Two bedrooms done in a day, edges are razor sharp and they put the "
        "furniture back exactly where it was.",
        "business",
    ),
    (
        "bk-mission-handyman",
        5,
        "TV is dead level and the shelves are solid. Cleaned up the brick dust "
        "without being asked.",
        "business",
    ),
    (
        "bk-inglewood-tap",
        4,
        "Fast, friendly, explained what the old wiring was doing. Would use "
        "again for the basement lights.",
        "business",
    ),
    (
        "bk-beltline-deepclean",
        5,
        "Easy client — clear instructions, keys ready, paid the same day.",
        "client",
    ),
    (
        "bk-bridgeland-paint",
        5,
        "Rooms were emptied before we arrived which saved us an hour. Great "
        "to work with.",
        "client",
    ),
    # ── screenshot set, added 2026-08-05 ────────────────────────────────────
    # Five businesses carry a scrollable reviews list now instead of a single
    # entry. Deliberately not all five stars: a wall of 5.0s reads as fake to
    # anyone scrolling it, and the 3-star with a reasonable complaint is what
    # makes the rest legible as real.
    (
        "bk-r1-beltline",
        5,
        "Second time using them. Same two cleaners, same standard — the glass "
        "shower door has never looked like that.",
        "business",
    ),
    (
        "bk-r2-beltline",
        4,
        "Very thorough on the kitchen and bathrooms. Missed the top of the "
        "fridge, though they came back for it when I asked.",
        "business",
    ),
    (
        "bk-r3-altadore",
        5,
        "Booked a one-off and ended up on a monthly. Baseboards and window "
        "tracks were the selling point.",
        "business",
    ),
    (
        "bk-r4-altadore",
        5,
        "She works around us with two kids in the house and never makes it "
        "awkward. Worth every dollar.",
        "business",
    ),
    (
        "bk-r5-kensington",
        5,
        "Quoted before starting, stuck to it, and showed me the corroded valve "
        "he pulled out. No upsell.",
        "business",
    ),
    (
        "bk-r6-kensington",
        3,
        "Fixed the leak properly but arrived near the end of the window with no "
        "message. Work was fine, communication was not.",
        "business",
    ),
    (
        "bk-r7-bridgeland",
        5,
        "Whole main floor in two days. They moved a piano themselves rather "
        "than ask me to sort it out.",
        "business",
    ),
    (
        "bk-r8-bridgeland",
        4,
        "Sharp lines and good colour advice. One small drip on the trim that "
        "they touched up same week.",
        "business",
    ),
    (
        "bk-r9-mission",
        5,
        "Four jobs I'd been putting off for a year, done in an afternoon. "
        "Brought his own everything.",
        "business",
    ),
    (
        "bk-r10-mission",
        5,
        "Hung a heavy mirror on plaster without a single crack. Knew exactly "
        "what anchors to use.",
        "business",
    ),
    (
        "bk-r11-mckenzie",
        4,
        "Careful with the furniture and nothing got scratched. Ran about an "
        "hour over the estimate.",
        "business",
    ),
    (
        "bk-r12-marda",
        5,
        "Same guy every week all summer, never had to chase him once.",
        "business",
    ),
    (
        "bk-r5-kensington",
        5,
        "Straightforward, knew what he wanted and left the access clear.",
        "client",
    ),
    (
        "bk-r11-mckenzie",
        5,
        "Everything boxed and labelled before we arrived. Ideal move.",
        "client",
    ),
]

# ── chat threads (booking-based) ────────────────────────────────────────────
# (booking_slug, [(sender: "client"|"business", minutes_before_now, text,
#                  read: bool)])
THREADS = {
    "bk-altadore-clean": [
        ("client", 2880, "Hi! Confirming Thursday at 10am for the deep clean?", True),
        (
            "business",
            2820,
            "Hi Nadia — yes, Thursday 10am works. Two of us, " "about three hours.",
            True,
        ),
        (
            "client",
            2760,
            "Perfect. The oven is the big one, it hasn't been "
            "done since we moved in.",
            True,
        ),
        (
            "business",
            2700,
            "No problem, we bring oven cleaner. Any pets in " "the house?",
            True,
        ),
        ("client", 2640, "One cat, she'll be shut in the bedroom.", True),
        ("business", 120, "We're all set for tomorrow — see you at 10.", False),
    ],
    # A finished job still has its history — this is the thread the demo opens
    # on a COMPLETED booking.
    "bk-beltline-deepclean": [
        (
            "client",
            37440,
            "Hi — booking the move-out clean for the 1-bed on "
            "12 Ave. Keys will be with the concierge.",
            True,
        ),
        (
            "business",
            37380,
            "Thanks Nadia. Two cleaners, roughly four hours "
            "for a move-out at that size.",
            True,
        ),
        (
            "client",
            37300,
            "The oven and the balcony door tracks are the worst " "of it.",
            True,
        ),
        (
            "business",
            34600,
            "All done — oven, tracks, inside cupboards. Left "
            "the keys back with the concierge.",
            True,
        ),
        (
            "client",
            34500,
            "Just did the walkthrough, landlord had zero notes. " "Thank you!",
            True,
        ),
    ],
    "bk-mckenzie-move": [
        (
            "client",
            4320,
            "Hey, do you bring wardrobe boxes or should I buy " "them?",
            True,
        ),
        (
            "business",
            4260,
            "We bring four wardrobe boxes free, extras are $8 " "each.",
            True,
        ),
        (
            "client",
            4200,
            "Four is plenty. Truck can park in the alley behind " "the unit.",
            True,
        ),
        (
            "business",
            4140,
            "Good to know. We'll start at 9am, should be done " "by 1pm at that size.",
            True,
        ),
        (
            "business",
            45,
            "Reminder: we arrive Saturday 9am. Please have the "
            "elevator booked if the new building needs it.",
            False,
        ),
    ],
    # ── screenshot set, added 2026-08-05 ────────────────────────────────────
    # The live job needs a conversation behind it. Without this the hero screen
    # has a chat button that opens on nothing, and the Messages inbox shows the
    # active job as "No messages yet" — which is precisely how the walkthrough
    # screenshots ended up looking abandoned.
    "bk-nadia-live-paint": [
        ("client", 3200, "Hi Yusuf — confirming Wednesday for the two bedrooms?", True),
        (
            "business",
            3140,
            "Confirmed. We'll be there for 8, two coats on both rooms, done by "
            "late afternoon.",
            True,
        ),
        (
            "client",
            3080,
            "Great. The warm white from the sample card is the one we want.",
            True,
        ),
        (
            "business",
            3020,
            "Noted — Cloud White, low-VOC. We bring the drop sheets and move the "
            "furniture in ourselves.",
            True,
        ),
        (
            "client",
            180,
            "Just left the key under the mat, the cat is shut upstairs.",
            True,
        ),
        (
            "business",
            20,
            "Masking done, first coat going on now. I'll send photos before we "
            "pack up.",
            False,
        ),
    ],
    "bk-hillhurst-fence": [
        (
            "client",
            600,
            "Panels are stacked by the garage, gate code is on " "the job post.",
            True,
        ),
        (
            "business",
            540,
            "Got it. On site now, one rail is split so I'll "
            "swap it — adds about $40 in material.",
            True,
        ),
        ("client", 500, "That's fine, go ahead.", True),
        (
            "business",
            90,
            "Both panels are back up and the new rail is in. "
            "Sending photos when I pack up.",
            False,
        ),
    ],
}

# ── live job timelines ──────────────────────────────────────────────────────
# (booking_slug, [(event_type, actor: "client"|"business", hours_before_confirmed,
#                  note)])
TIMELINES = {
    # The two bookings belonging to the primary demo client (Nadia Whitfield)
    # carry full timelines — that is the account the demo logs in as, so the
    # booking detail screen must not open on an empty timeline.
    "bk-beltline-deepclean": [
        ("dates_proposed", "business", 96, "Three cleaning slots offered"),
        ("date_confirmed", "client", 92, "Client picked the Tuesday slot"),
        ("en_route", "business", 1, "Crew on the way"),
        ("arrived", "business", 0, "Arrived, keys collected from concierge"),
        ("started", "business", 0, "Starting in the kitchen"),
        ("completed", "business", -4, "Move-out clean finished, keys returned"),
    ],
    "bk-kensington-heater": [
        ("dates_proposed", "business", 50, "Two same-week slots offered"),
        ("date_confirmed", "client", 48, "Morning slot confirmed"),
        ("en_route", "business", 1, "Leaving the supply shop with the part"),
        ("arrived", "business", 0, "On site"),
        ("started", "business", 0, "Draining the tank"),
        ("completed", "business", -3, "Element replaced, hot water restored"),
    ],
    "bk-bridgeland-paint": [
        ("dates_proposed", "business", 72, "Offered three start dates"),
        ("date_confirmed", "client", 68, "Client picked the earliest date"),
        ("en_route", "business", 1, "On the way, 15 minutes out"),
        ("arrived", "business", 0, "Arrived on site"),
        ("started", "business", 0, "Masking and drop sheets down"),
        ("completed", "business", -7, "Both bedrooms finished and cleaned up"),
    ],
    "bk-mission-handyman": [
        ("dates_proposed", "business", 48, "Two evening slots offered"),
        ("date_confirmed", "client", 46, "Thursday evening confirmed"),
        ("en_route", "business", 1, "Leaving the shop now"),
        ("arrived", "business", 0, "Buzzed up to the unit"),
        ("started", "business", 0, "Marking studs for the mount"),
        ("completed", "business", -2, "TV mounted, shelves level, site tidy"),
    ],
    "bk-hillhurst-fence": [
        ("dates_proposed", "business", 30, "Offered tomorrow or Saturday"),
        ("date_confirmed", "client", 28, "Tomorrow morning confirmed"),
        ("en_route", "business", 2, "Heading over with the lumber"),
        ("arrived", "business", 1, "On site, unloading"),
        ("started", "business", 0, "Pulling the broken rail"),
    ],
    # ── screenshot set, added 2026-08-05 ────────────────────────────────────
    # THE hero screen. Stops at `started` on purpose: the live-tracking view
    # renders the Confirmed -> On the way -> In progress -> Done rail from the
    # last event, so adding `completed` here would grey the whole thing out and
    # lose the shot. Nadia is the account the demo logs into, and before this
    # she had no in-progress job at all.
    "bk-nadia-live-paint": [
        ("dates_proposed", "business", 54, "Three start dates offered"),
        ("date_confirmed", "client", 50, "Client picked Wednesday"),
        ("en_route", "business", 2, "On the way — about 20 minutes out"),
        ("arrived", "business", 1, "Arrived, unloading drop sheets"),
        ("started", "business", 0, "Masking the trim in the first bedroom"),
    ],
    # Nadia's upcoming booking opened on an empty timeline before this — the
    # booking detail screen looked broken rather than merely early.
    "bk-altadore-clean": [
        ("dates_proposed", "business", 40, "Two morning slots offered"),
        ("date_confirmed", "client", 36, "Thursday 10am confirmed"),
    ],
}


# ── proof-of-work photos ────────────────────────────────────────────────────
# (booking_slug, phase, filename, caption)
#
# These are PLACEHOLDERS, not photographs, and each image carries a "SAMPLE"
# mark on its face. The proof-of-work panel needs rows so the screen renders and
# the marketing pipeline has something to build against; inventing photorealistic
# "completed work" for an App Store submission would be a claim about jobs that
# never happened. Swap in real tester photos later — only the files change, the
# rows and ids stay put.
#
# Uploaded to the public `job-photos` bucket under demo/proof/ on 2026-08-05.
PHOTO_BUCKET_PREFIX = "demo/proof"
PHOTOS = [
    (
        "bk-beltline-deepclean",
        "before",
        "beltline-before.jpg",
        "Kitchen before the move-out clean",
    ),
    (
        "bk-beltline-deepclean",
        "after",
        "beltline-after.jpg",
        "Same kitchen, cleaned and handed back",
    ),
    (
        "bk-kensington-heater",
        "before",
        "kensington-before.jpg",
        "Failed element, no hot water",
    ),
    (
        "bk-kensington-heater",
        "after",
        "kensington-after.jpg",
        "Element replaced, hot water restored",
    ),
    # In-progress job: a `before` with no `after` yet is exactly what a live
    # booking should look like, and it keeps the hero screen honest.
    (
        "bk-nadia-live-paint",
        "before",
        "paint-before.jpg",
        "First bedroom before the repaint",
    ),
]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def build(now: datetime | None = None) -> dict:
    """
    Materialise the whole dataset as table -> list[row] payloads whose keys
    are exactly the live columns. `now` is injectable so the output is
    reproducible in tests.
    """
    now = now or datetime.now(timezone.utc)

    users: list[dict] = []
    accounts: list[dict] = []  # auth-side records (id + email + names + role)

    for slug, first, last, phone in OWNERS:
        uid = did("user", slug)
        accounts.append(
            {
                "id": uid,
                "email": _email(slug),
                "first_name": first,
                "last_name": last,
                "role": "business_owner",
            }
        )
        users.append(
            {
                "id": uid,
                "first_name": first,
                "last_name": last,
                "email": _email(slug),
                "phone": phone,
                "role": "business_owner",
                "avatar_url": None,
                "created_at": _iso(now - timedelta(days=120)),
            }
        )

    for slug, first, last, phone in CLIENTS:
        uid = did("user", slug)
        accounts.append(
            {
                "id": uid,
                "email": _email(slug),
                "first_name": first,
                "last_name": last,
                "role": "client",
            }
        )
        users.append(
            {
                "id": uid,
                "first_name": first,
                "last_name": last,
                "email": _email(slug),
                "phone": phone,
                "role": "client",
                "avatar_url": None,
                "created_at": _iso(now - timedelta(days=90)),
            }
        )

    businesses: list[dict] = []
    biz_id_by_owner: dict[str, str] = {}
    for (
        owner_slug,
        name,
        category,
        custom,
        hood,
        lat,
        lng,
        radius,
        rating,
        reviews_n,
        blurb,
    ) in BUSINESSES:
        bid = did("business", owner_slug)
        biz_id_by_owner[owner_slug] = bid
        businesses.append(
            {
                "id": bid,
                "owner_id": did("user", owner_slug),
                "business_name": name,
                "category": category,
                "custom_category": custom,
                "description": f"{blurb} Based in {hood}.",
                "license_number": None,
                "license_status": "verified",
                "lat": lat,
                "lng": lng,
                "service_radius_km": float(radius),
                "avg_rating": rating,
                "review_count": reviews_n,
                "subscription_tier": "solo",
                "subscription_status": "active",
                "created_at": _iso(now - timedelta(days=110)),
            }
        )

    matched_posts = {b[3] for b in BOOKINGS if b[3]}
    posts: list[dict] = []
    for (
        slug,
        client_slug,
        title,
        category,
        budget,
        address,
        lat,
        lng,
        days_ago,
        pref_days,
        desc,
    ) in POSTS:
        posts.append(
            {
                "id": did("post", slug),
                "client_id": did("user", client_slug),
                "title": title,
                "description": desc,
                "category": category,
                "budget": budget,
                "status": "matched" if slug in matched_posts else "open",
                "lat": lat,
                "lng": lng,
                "address": address,
                "preferred_date": _iso(now + timedelta(days=pref_days)),
                "geocoded_at": _iso(now - timedelta(days=days_ago)),
                "geocode_source": "manual",
                "image_urls": [],
                "expires_at": _iso(now + timedelta(days=max(pref_days, 1) + 7)),
                "created_at": _iso(now - timedelta(days=days_ago)),
                "target_business_id": None,
            }
        )

    bookings: list[dict] = []
    payments: list[dict] = []
    booking_meta: dict[str, dict] = {}
    for (
        slug,
        client_slug,
        biz_slug,
        post_slug,
        category,
        amount,
        status,
        pay_status,
        created_days_ago,
        confirmed_in_days,
    ) in BOOKINGS:
        bid = did("booking", slug)
        created = now - timedelta(days=created_days_ago)
        confirmed = now + timedelta(days=confirmed_in_days)
        client_id = did("user", client_slug)
        owner_id = did("user", biz_slug)
        booking_meta[slug] = {
            "id": bid,
            "client_id": client_id,
            "owner_id": owner_id,
            "confirmed": confirmed,
            "status": status,
        }
        bookings.append(
            {
                "id": bid,
                "client_id": client_id,
                "business_id": biz_id_by_owner[biz_slug],
                "employee_id": None,
                "post_id": did("post", post_slug) if post_slug else None,
                "service_category": category,
                "total_amount": amount,
                "commission_rate": 0.10,
                "platform_fee": round(amount * 0.10, 2),
                "status": status,
                "payment_status": pay_status,
                "proposed_date_1": _iso(confirmed),
                "proposed_date_2": _iso(confirmed + timedelta(days=1)),
                "proposed_date_3": _iso(confirmed + timedelta(days=2)),
                # ONLY in_progress/completed may carry a confirmed_date. The API
                # writes the date and flips the status to in_progress in the SAME
                # update (bookings.py confirm-date), so `confirmed` + a date is a
                # state production cannot reach — and the business app treats it
                # as impossible: bookingBuckets.js buckets every `confirmed` row
                # to needsAction, so a dated one never appears under Today or
                # Upcoming. The client screen reads confirmed_date directly and
                # DID show it, which is how one booking looked confirmed to the
                # client and non-existent to the business.
                "confirmed_date": None if status == "confirmed" else _iso(confirmed),
                "date_proposed_by": owner_id,
                "created_at": _iso(created),
            }
        )
        fee = round(amount * 0.10, 2)
        released = status == "completed"
        payments.append(
            {
                "id": did("payment", slug),
                "booking_id": bid,
                "total_charged": amount,
                "escrow_held": 0.0 if released else round(amount - fee, 2),
                "released_to_business": round(amount - fee, 2) if released else 0.0,
                "platform_cut": fee,
                # A held row with no PaymentIntent is NOT capture backed
                # (escrow.is_capture_backed), so /payments/mine excludes it from
                # `total_pending` and the business dashboard correctly reports
                # $0 held — that guard exists because showing escrow against
                # money nobody paid is a false financial statement (AUDIT L5).
                # Demo data represents captured money, so it needs an id. The
                # `pi_demo_` prefix makes these unmistakable against real Stripe
                # ids, and it is deterministic so re-seeding does not churn.
                "stripe_payment_intent_id": f"pi_demo_{did('payment', slug).replace('-', '')[:24]}",
                "status": "fully_released" if released else "held",
                "released_at": (
                    _iso(confirmed + timedelta(hours=6)) if released else None
                ),
                "method": "stripe_card",
                "currency": "CAD",
                "created_at": _iso(created),
            }
        )

    reviews: list[dict] = []
    for idx, (booking_slug, rating, comment, direction) in enumerate(REVIEWS):
        meta = booking_meta[booking_slug]
        if direction == "business":
            # Matches app/api/reviews.py: a 'business' review targets the
            # BUSINESS row id (not the owner's user id) — that is what
            # GET /reviews/business/{business_id} filters on.
            reviewer, reviewee = meta["client_id"], _business_of(
                booking_slug, biz_id_by_owner
            )
        else:
            reviewer, reviewee = meta["owner_id"], meta["client_id"]
        reviews.append(
            {
                "id": did("review", f"{booking_slug}:{direction}:{idx}"),
                "booking_id": meta["id"],
                "reviewer_id": reviewer,
                "reviewee_id": reviewee,
                "reviewee_type": direction,
                "rating": rating,
                "comment": comment,
                "created_at": _iso(meta["confirmed"] + timedelta(hours=20)),
            }
        )

    messages: list[dict] = []
    for booking_slug, thread in THREADS.items():
        meta = booking_meta[booking_slug]
        for idx, (who, mins_ago, text, was_read) in enumerate(thread):
            sender = meta["client_id"] if who == "client" else meta["owner_id"]
            sent = now - timedelta(minutes=mins_ago)
            messages.append(
                {
                    "id": did("message", f"{booking_slug}:{idx}"),
                    "booking_id": meta["id"],
                    "interest_id": None,
                    "sender_id": sender,
                    "content": text,
                    "sent_at": _iso(sent),
                    "read_at": _iso(sent + timedelta(minutes=4)) if was_read else None,
                }
            )

    events: list[dict] = []
    for booking_slug, timeline in TIMELINES.items():
        meta = booking_meta[booking_slug]
        for idx, (etype, who, hours_before, note) in enumerate(timeline):
            actor = meta["client_id"] if who == "client" else meta["owner_id"]
            events.append(
                {
                    "id": did("event", f"{booking_slug}:{idx}"),
                    "booking_id": meta["id"],
                    "actor_id": actor,
                    "event_type": etype,
                    "note": note,
                    "lat": None,
                    "lng": None,
                    "created_at": _iso(
                        meta["confirmed"] - timedelta(hours=hours_before)
                    ),
                }
            )

    # Public bucket URL is derived from SUPABASE_URL at build time rather than
    # hardcoded, so the seed still points at the right project if it is ever run
    # against a branch database.
    base = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    photos: list[dict] = []
    for booking_slug, phase, filename, caption in PHOTOS:
        meta = booking_meta[booking_slug]
        path = f"{PHOTO_BUCKET_PREFIX}/{filename}"
        photos.append(
            {
                "id": did("photo", f"{booking_slug}:{phase}:{filename}"),
                "booking_id": meta["id"],
                # The business uploads proof of work, so the actor is the owner
                # and `source` must agree with that — the check constraint
                # allows business|client and the UI labels them differently.
                "uploaded_by": meta["owner_id"],
                "source": "business",
                "phase": phase,
                "url": f"{base}/storage/v1/object/public/job-photos/{path}",
                "path": path,
                "caption": caption,
                "created_at": _iso(meta["confirmed"] + timedelta(hours=1)),
            }
        )

    return {
        "accounts": accounts,
        "users": users,
        "businesses": businesses,
        "service_posts": posts,
        "bookings": bookings,
        "payments": payments,
        "reviews": reviews,
        "messages": messages,
        "booking_events": events,
        "booking_photos": photos,
    }


def _business_of(booking_slug: str, biz_id_by_owner: dict) -> str:
    """reviewee_id for a 'business' review = the businesses.id of that booking."""
    for slug, _client, biz_slug, *_rest in BOOKINGS:
        if slug == booking_slug:
            return biz_id_by_owner[biz_slug]
    raise KeyError(booking_slug)


# Order matters: parents before children on insert, reverse on delete.
INSERT_ORDER = [
    "users",
    "businesses",
    "service_posts",
    "bookings",
    "payments",
    "reviews",
    "messages",
    "booking_events",
    "booking_photos",
]
DELETE_ORDER = list(reversed(INSERT_ORDER))
