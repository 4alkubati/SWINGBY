"""
test_money.py — PAYMENT-MODEL.md §9 items 1 and 3.

1. Ledger invariant: escrow_held + released_to_business + platform_cut ==
   total_charged, in every state, over a range of totals including the
   half-cent-fee-prone values called out in the spec (2.675, 33.33, 105.55).
3. No floats: the money module never touches `float()` in its arithmetic —
   Decimal in, Decimal out, `float()` only ever appears at documented
   boundaries (there are none in this module; the boundary conversions are
   `to_cents` -> int and `to_db_string` -> str).
"""

from __future__ import annotations

import ast
from decimal import Decimal
from pathlib import Path

import pytest

from app.services import money

MONEY_MODULE_PATH = Path(money.__file__)


# ── §9.1 — the ledger invariant, in every state ─────────────────────────────


TOTALS = [
    Decimal("10.00"),
    Decimal("50.00"),
    Decimal("100.00"),
    Decimal("2.675"),  # rounds to 2.68 on input — half-cent-prone
    Decimal("33.33"),  # classic non-round-tripping total
    Decimal("105.55"),  # the exact figure called out in the spec (§3)
    Decimal("0.01"),
    Decimal("999999.99"),
    Decimal("19.99"),
    Decimal("1.11"),
    Decimal("7.77"),
]


class TestLedgerInvariant:
    @pytest.mark.parametrize("total", TOTALS)
    def test_charge_captured_state_balances(self, total):
        """escrow_held=business_net, released=0, cut=cut."""
        ledger = money.derive_ledger(total)
        escrow_held = ledger.business_net
        released = Decimal("0.00")
        money.assert_ledger_balances(
            escrow_held, released, ledger.platform_cut, ledger.total_charged
        )

    @pytest.mark.parametrize("total", TOTALS)
    def test_date_confirmed_state_balances(self, total):
        """escrow_held=business_net-first_release, released=first_release, cut=cut."""
        ledger = money.derive_ledger(total)
        escrow_held = ledger.business_net - ledger.first_release
        released = ledger.first_release
        money.assert_ledger_balances(
            escrow_held, released, ledger.platform_cut, ledger.total_charged
        )

    @pytest.mark.parametrize("total", TOTALS)
    def test_job_completed_state_balances(self, total):
        """escrow_held=0, released=business_net, cut=cut."""
        ledger = money.derive_ledger(total)
        escrow_held = Decimal("0.00")
        released = ledger.business_net
        money.assert_ledger_balances(
            escrow_held, released, ledger.platform_cut, ledger.total_charged
        )

    @pytest.mark.parametrize("total", TOTALS)
    def test_second_release_is_exact_remainder_not_a_second_rounding(self, total):
        """
        The bug this spec exists to kill: computing second_release as
        round(business_net * 0.5, 2) instead of the remainder loses a cent on
        totals like $33.33 / $105.55. Assert the remainder identity directly.
        """
        ledger = money.derive_ledger(total)
        assert ledger.first_release + ledger.second_release == ledger.business_net
        # And explicitly: it must NOT equal the (wrong) second rounding when
        # that would produce a different number.
        wrong_second_release = money.quantize(ledger.business_net * Decimal("0.50"))
        if ledger.business_net % Decimal("0.02") != 0:
            # An odd-cent business_net is exactly where naive double-rounding
            # diverges from the true remainder.
            assert ledger.second_release != wrong_second_release or (
                ledger.first_release == wrong_second_release
            )

    def test_known_bug_case_10555_never_loses_a_cent(self):
        """
        The exact figure named in PAYMENT-MODEL.md §3: the old float path
        made the platform take 9.9953% instead of 10% on $105.55.
        """
        ledger = money.derive_ledger("105.55")
        assert ledger.total_charged == Decimal("105.55")
        assert ledger.platform_cut == Decimal(
            "10.56"
        )  # round(105.55 * 0.10, 2) = 10.555 -> 10.56 (ROUND_HALF_UP)
        assert ledger.business_net == Decimal("94.99")
        assert ledger.first_release + ledger.second_release == ledger.business_net
        assert ledger.platform_cut + ledger.business_net == ledger.total_charged

    def test_derive_ledger_rejects_non_positive_total(self):
        with pytest.raises(money.MoneyError):
            money.derive_ledger(Decimal("0.00"))
        with pytest.raises(money.MoneyError):
            money.derive_ledger(Decimal("-5.00"))

    def test_assert_ledger_balances_raises_on_mismatch(self):
        with pytest.raises(money.MoneyError):
            money.assert_ledger_balances(
                Decimal("10.00"), Decimal("10.00"), Decimal("10.00"), Decimal("100.00")
            )


# ── §9.3 — no floats in the money path ──────────────────────────────────────


class TestNoFloatsInMoneyModule:
    def test_money_module_source_has_no_float_calls(self):
        """
        PAYMENT-MODEL.md §3: "No float anywhere in the money path." Scans the
        actual source (not just behavior) so a future edit that reintroduces
        `float(...)` arithmetic here fails loudly.
        """
        source = MONEY_MODULE_PATH.read_text()
        tree = ast.parse(source)
        float_calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "float"
        ]
        assert float_calls == [], (
            "app/services/money.py must never call float() — Decimal in, "
            "Decimal out, at every boundary."
        )

    def test_derive_ledger_returns_only_decimals(self):
        ledger = money.derive_ledger("19.99")
        for field in ledger._fields:
            assert isinstance(getattr(ledger, field), Decimal)

    def test_to_cents_returns_int_not_float(self):
        cents = money.to_cents("19.99")
        assert isinstance(cents, int)
        assert cents == 1999

    def test_to_db_string_returns_str_not_float(self):
        s = money.to_db_string(Decimal("19.99"))
        assert isinstance(s, str)
        assert s == "19.99"

    def test_quantize_rounds_half_up(self):
        # ROUND_HALF_UP, not banker's rounding: 0.125 -> 0.13 (not 0.12).
        assert money.quantize("2.675") == Decimal("2.68")
        assert money.quantize("10.005") == Decimal("10.01")

    def test_validate_two_decimal_places_rejects_extra_precision(self):
        with pytest.raises(money.MoneyError):
            money.validate_two_decimal_places("105.555")
        # Exactly 2 (or fewer) decimal places is fine.
        assert money.validate_two_decimal_places("105.5") == Decimal("105.50")
        assert money.validate_two_decimal_places(105) == Decimal("105.00")

    def test_validate_two_decimal_places_rejects_non_positive(self):
        with pytest.raises(money.MoneyError):
            money.validate_two_decimal_places("0.00")
        with pytest.raises(money.MoneyError):
            money.validate_two_decimal_places("-1.00")
