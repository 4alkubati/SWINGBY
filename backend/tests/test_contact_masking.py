"""
test_contact_masking.py — item 31 off-platform-leakage guard.

Two jobs:
  1. MUST_MASK — every realistic way a user tries to pass a phone/email,
     including the evasions the brief called out (spacing, unicode digits).
  2. MUST_NOT_MASK — the legitimate-message false-positive matrix: prices,
     addresses, dates/times, quantities. A regression here mangles real chat,
     which is worse than a missed evasion, so this list is the load-bearing one.
"""

from app.services.contact_masking import MASK_TOKEN, mask_contact_info

MUST_MASK = [
    # Plain / formatted NANP
    "403-555-1234",
    "4035551234",
    "(403) 555-1234",
    "403.555.1234",
    "403 555 1234",
    "call me at 403-555-1234 anytime",
    "+1 403 555 1234",
    "1-403-555-1234",
    "1 (403) 555-1234",
    "my cell is 587 555 0182",
    # Toll-free (11-digit leading 1)
    "reach us 1 800 555 0199",
    # 7-digit local with dash/dot
    "just call 555-1234",
    "555.1234 is my line",
    # Evasions
    "4 0 3 5 5 5 1 2 3 4",  # spaced single digits
    "４０３５５５１２３４",  # fullwidth unicode digits
    "４０３-５５５-１２３４",  # fullwidth + dashes
    # Emails
    "email me john.doe@gmail.com please",
    "reach me at casey_smith+jobs@outlook.co.uk",
    "JOHN@EXAMPLE.COM",
    # Spoken email evasion
    "john doe at gmail dot com",
]

MUST_NOT_MASK = [
    # Prices — the big one
    "The price is $180.00",
    "It'll cost $1,234.56 total",
    "About 1200 dollars for the whole job",
    "$99 flat",
    "Two rooms at $250.50 and $175.25",
    "I'll pay 50% up front",
    # Addresses
    "123 Main St NW, Calgary, AB T2N 1N4",
    "Unit 4, 5600 84 St SE",
    "I'm at 12345 67 Ave",
    "Suite 300, 1234 5 Ave",
    # Dates / times
    "Let's meet at 10:30 on 2026-08-01",
    "How about August 1 at 3pm",
    "Booked for 2026-08-01",
    "Between 9 and 5 tomorrow",
    # Quantities / misc
    "I have 3 bedrooms and 2 bathrooms",
    "Room is 12 by 15 feet",
    "5 star service, thanks!",
    "Invoice SWB-73F88F2F is ready",
    "We need 20 chairs and 4 tables",
    "Order 4 of them please",
    "The lot is 50 by 100",
    "It's 6 units on floor 2",
]


def test_must_mask():
    failures = []
    for msg in MUST_MASK:
        masked, was = mask_contact_info(msg)
        if not was or MASK_TOKEN not in masked:
            failures.append(f"MISSED: {msg!r} -> {masked!r}")
    assert not failures, "\n".join(failures)


def test_must_not_mask():
    failures = []
    for msg in MUST_NOT_MASK:
        masked, was = mask_contact_info(msg)
        if was or masked != msg:
            failures.append(f"FALSE POSITIVE: {msg!r} -> {masked!r}")
    assert not failures, "\n".join(failures)


def test_flag_and_idempotent():
    masked, was = mask_contact_info("call 403-555-1234")
    assert was is True
    assert MASK_TOKEN in masked
    # Re-masking already-masked text changes nothing and re-reports clean.
    again, was2 = mask_contact_info(masked)
    assert again == masked
    assert was2 is False


def test_empty_and_none():
    assert mask_contact_info("") == ("", False)
    assert mask_contact_info(None) == (None, False)


def test_price_and_phone_in_one_message():
    masked, was = mask_contact_info("Job is $250.00, text me at 403 555 1234")
    assert was is True
    assert "$250.00" in masked  # price survives
    assert "403" not in masked  # phone gone
