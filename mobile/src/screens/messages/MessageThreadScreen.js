// MessageThreadScreen — consolidated into ChatScreen (2026-07-22).
//
// This screen and ChatScreen were near-duplicate chat implementations (509 vs
// 615 lines) with divergent behaviour: only this one had optimistic sending and
// older-history paging, only ChatScreen had the quote/interest thread, the
// booking summary, the quote bubble and the profile tap-through. Every
// navigation callsite except two already went to ChatScreen, so ChatScreen is
// now the single implementation — its optimistic send and paging are ports of
// what lived here.
//
// The `MessageThread` route stays registered (both navigators, plus the
// `messages/:bookingId` deep link in services/linking.js) and takes the same
// { bookingId } param ChatScreen reads, so callers need no change.
export { default } from './ChatScreen';
