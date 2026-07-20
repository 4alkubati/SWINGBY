-- 0003_users_card_on_file.sql
--
-- PAYMENT-MODEL.md §5 — "Card on file is created with a Stripe SetupIntent
-- and a saved payment method on a Stripe Customer." There was no column
-- anywhere to persist that for a client (businesses already have
-- `stripe_customer_id` for subscriptions — see docs/swingby_database_schema.md
-- §2 — but clients had nothing).
--
-- `default_payment_method_id` is the saved card charged off-session at quote
-- acceptance (PATCH /interests/{id}/accept). Both nullable: a user with
-- neither is simply blocked from accepting a quote / requesting a booking
-- until they add a card (enforced in app code, not by a NOT NULL here, since
-- most users won't have added a card yet at signup).

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_payment_method_id text;
