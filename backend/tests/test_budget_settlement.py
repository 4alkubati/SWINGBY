"""The founder's own worked example, pinned.

Kira wrote this by hand on 2026-07-26 after describing it verbally seven times
without it reaching the code:

    lets say Budget is 150 and I accept 100$
    50$ get released and 50$ in escrow and 50$ get refunded.

and confirmed the cut the same day: "the 100 is the total our cut is 10$".

If these tests fail, the code no longer implements what he asked for. That is
the entire point of the file — every previous attempt at this model was
described in prose, disagreed with by the code, and nobody could tell.
"""

import pytest

from app.services import budget_settlement as bs

BUDGET = 15000  # $150.00
ACCEPTED = 10000  # $100.00


class TestKirasWorkedExample:
    def test_the_platform_cut_is_ten_dollars_on_a_hundred(self):
        # "the 100 is the total our cut is 10$"
        assert bs.platform_cut_cents(ACCEPTED) == 1000

    def test_accepting_below_budget_refunds_exactly_the_difference(self):
        led = bs.settle_on_accept(BUDGET, ACCEPTED)
        assert led["refund_cents"] == 5000, "150 - 100 = 50 goes back"

    def test_the_business_nets_ninety_of_a_hundred(self):
        led = bs.settle_on_accept(BUDGET, ACCEPTED)
        assert led["business_net_cents"] == 9000
        assert led["platform_cut_cents"] == 1000

    def test_there_is_no_staged_release_to_test(self):
        # This class used to assert the 50/50: "50$ released and 50$ in escrow"
        # after the date handshake. The functions behind it
        # (settle_on_date_confirmed / settle_on_complete) had no callers — the
        # app never released anything on date-confirm — so the test passed for
        # years while describing something that did not happen.
        #
        # Both are deleted. Release timing belongs to services/approvals.py:
        # the client approves, or 24h passes. Asserting their ABSENCE here is
        # what stops them coming back as "the design".
        assert not hasattr(bs, "settle_on_date_confirmed")
        assert not hasattr(bs, "settle_on_complete")

    def test_the_whole_thing_balances_at_every_step(self):
        steps = {}
        steps["posted"] = bs.settle_at_post(BUDGET)
        steps["accepted"] = bs.settle_on_accept(BUDGET, ACCEPTED)
        for name, led in steps.items():
            assert bs.ledger_balances(led), f"{name} does not balance: {led}"
            assert led["total_charged_cents"] == BUDGET

    def test_the_accept_state_matches_the_drawing(self):
        # The drawing's "$50 refunded, $100 the job, our cut $10" is settled at
        # ACCEPT. What used to follow it here — walking the ledger through a
        # staged release — tested code the app never ran.
        led = bs.settle_on_accept(BUDGET, ACCEPTED)
        assert led["escrow_held_cents"] == 10000  # the job, still held
        assert led["refunded_cents"] == 5000      # client got 50 back
        assert 10000 + 5000 == BUDGET             # exactly the drawing
        # OUR cut, taken from the business's $100, leaving them $90.
        assert led["platform_cut_cents"] == 1000
        assert led["business_net_cents"] == 9000


class TestPostedButNotYetQuoted:
    def test_the_entire_budget_sits_in_escrow(self):
        led = bs.settle_at_post(BUDGET)
        assert led["escrow_held_cents"] == BUDGET
        assert bs.ledger_balances(led)

    def test_no_platform_cut_is_taken_before_anyone_accepts(self):
        # The platform has done nothing yet, and a cut here would only have to
        # be handed back at expiry.
        assert bs.settle_at_post(BUDGET)["platform_cut_cents"] == 0


class TestExpiryRefundsEverything:
    def test_an_unquoted_post_returns_the_whole_budget(self):
        led = bs.settle_on_expiry(bs.settle_at_post(BUDGET))
        assert led["refund_cents"] == BUDGET
        assert led["refunded_cents"] == BUDGET
        assert led["escrow_held_cents"] == 0
        assert bs.ledger_balances(led)

    def test_this_is_what_stops_the_model_keeping_peoples_money(self):
        # Charging at post is only safe because this path exists. If escrow
        # survived expiry, a client whose job nobody quoted would simply be out
        # their budget, with nothing on screen to tell them.
        led = bs.settle_on_expiry(bs.settle_at_post(BUDGET))
        assert led["escrow_held_cents"] == 0


class TestRoundingCannotLoseACent:
    @pytest.mark.parametrize("accepted", [1, 3, 7, 99, 101, 10555, 33333, 99999])
    def test_odd_totals_still_balance(self, accepted):
        budget = max(accepted, 100000)
        led = bs.settle_on_accept(budget, accepted)
        assert bs.ledger_balances(led)

    @pytest.mark.parametrize("accepted", [1, 3, 7, 99, 101, 10555, 33333])
    def test_escrow_holds_the_accepted_amount_exactly(self, accepted):
        # Was "the two tranches sum to the accepted amount" — there are no
        # tranches. What must hold on an odd total is that accept escrows the
        # accepted amount to the cent, with the rest refunded and nothing lost
        # to rounding.
        acc = bs.settle_on_accept(max(accepted, 100000), accepted)
        assert acc["escrow_held_cents"] == accepted
        assert bs.ledger_balances(acc)

    def test_the_cut_is_never_under_ten_percent_from_float_error(self):
        # round(105.55 * 0.10, 2) took 9.9953% instead of 10%, always in the
        # business's favour. Integer arithmetic, half-up.
        assert bs.platform_cut_cents(10555) == 1056


class TestAcceptingAboveBudget:
    def test_nothing_is_refunded_and_the_difference_is_owed(self):
        led = bs.settle_on_accept(10000, 12000)
        assert led["refund_cents"] == 0
        assert led["additional_charge_cents"] == 2000

    def test_the_ledger_still_balances_against_the_larger_total(self):
        led = bs.settle_on_accept(10000, 12000)
        assert led["total_charged_cents"] == 12000
        assert bs.ledger_balances(led)


class TestGuards:
    def test_negative_amounts_are_refused(self):
        with pytest.raises(ValueError):
            bs.settle_at_post(-1)
        with pytest.raises(ValueError):
            bs.settle_on_accept(-1, 100)

    def test_assert_balances_names_the_broken_path(self):
        bad = {
            "total_charged_cents": 15000,
            "escrow_held_cents": 1,
            "released_to_business_cents": 0,
            "platform_cut_cents": 0,
            "refunded_cents": 0,
        }
        with pytest.raises(ValueError, match="does not balance at accept"):
            bs.assert_balances(bad, where="accept")

    def test_a_zero_budget_is_representable(self):
        # Free/quote-only posts must not explode the arithmetic.
        led = bs.settle_at_post(0)
        assert bs.ledger_balances(led)
        assert bs.platform_cut_cents(0) == 0
