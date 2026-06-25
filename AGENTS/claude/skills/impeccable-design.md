# impeccable-design — make the UI look professional, not "AI-built"

Back to [[MAP]]. The design-agent's weapon. Wraps the open-source **impeccable** skill (28k★, Apache-2.0).

- **What:** a frontend design language for the harness — 7 references (type, color, spatial, motion, interaction, responsive, UX writing), 23 commands, 27 anti-pattern rules.
- **Who:** the [[PRODUCT-VISION]] design-agent + mobile-agent, in the Claude Code (BOH) chat.
- **When:** any task that touches how a screen *looks* or *feels* — new screen, polish pass, empty/loading/error states, the Live Job Status timeline, the before/after photo viewer.
- **Where:** installed at repo root `Swingby/.claude/skills/impeccable/` (Claude Code auto-discovers it). Install once: see HUMAN-TODO.
- **Why:** the moat is **trust**. A screen that looks beginner kills trust before a tester taps anything. This enforces calm/premium/local and bans the tells (Inter everywhere, purple gradients, cards-in-cards, gray-on-color).
- **How:**
  1. Before building any UI, run `/impeccable shape <screen>` to plan UX first.
  2. Build it.
  3. Before marking DONE, run `/impeccable audit <screen>` (a11y/responsive) + `/impeccable critique <screen>` (hierarchy/clarity), then `/impeccable polish <screen>`.
  4. Feed exact tokens (hex/px) back into the design-agent's spec so mobile uses them.

**Done-rule:** screen passes `/impeccable audit` with no anti-pattern hits + meets WCAG AA. "Looks clean" is not enough — the audit must pass.

---
*[[MAP]] · used by the [[PRODUCT-VISION]] design slice · enforced via [[verification-before-completion]] · pairs with [[internal-focus-group]] (does it feel right to a real user) + [[ask-the-board]] (the designer persona)*
