# Handoff — SwingBy mock atlas (2026-07-17)

Source: Claude-design polish handoff (`swingby-mocks-standalone.html`), delivered by Kira via inbox.

- **31 screens**, each labeled with its target file (e.g. `QuoteComparisonScreen.js`) — open the HTML in a browser to view.
- Same rules as `design/handoff-jet-pulse/README.md`: the HTML is a **design reference, not production code**. Recreate in React Native using `mobile/src/theme/tokens.js` + `typography.js`. Never copy the HTML/CSS.
- Data the app can't provide yet (online presence, read receipts) gets mocked behind a clearly-marked mock service so screens match the design now.

Implementation is dispatched via the execution spec (see AGENTS session notes, 2026-07-17).
