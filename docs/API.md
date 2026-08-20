# SwingBy Backend API

> **Generated — do not hand-edit.** Written by `python3 tools/gen_api_docs.py`
> from the running app's own route table. A hand-kept list drifted to 51 of 144
> endpoints, with 7 routes that did not exist (SB-0066).

Base URL: `http://127.0.0.1:8000` (physical device: `http://10.0.0.168:8000`,
Android emulator: `http://10.0.2.2:8000`).

Most routes require `Authorization: Bearer <token>`. The unauthenticated ones
are listed under **Public / unauthenticated** at the bottom — that list is
derived from the code, not from memory, because it had been wrong before
(SB-0067).

Swagger (`/docs`) is served in development only. It is disabled when
`ENV=production` because it published the complete route inventory to anyone
who asked; set `API_ENABLE_DOCS=1` to re-enable it deliberately.


**145 endpoints across 30 groups.**


## admin

```
GET   /admin/audit-log                                      # Read Audit Log
GET   /admin/bookings                                       # List Bookings
GET   /admin/businesses                                     # List Businesses For Admin
POST  /admin/businesses/{business_id}/verify                # Set Business License
POST  /admin/force-complete-booking/{booking_id}            # Force Complete Booking
GET   /admin/monitoring-probe                               # Monitoring Probe
POST  /admin/suspend-user/{user_id}                         # Suspend User
POST  /admin/sweeps/approval-releases                       # Sweep Approval Releases
POST  /admin/sweeps/login-attempts                          # Sweep Login Attempts
POST  /admin/sweeps/post-expiry                             # Sweep Post Expiry
POST  /admin/unsuspend-user/{user_id}                       # Unsuspend User
GET   /admin/users                                          # List Users
GET   /admin/waitlist-count                                 # Waitlist Count
```

## analytics-export

```
GET  /analytics/export                                      # Export Analytics
```

## auth

```
POST   /auth/forgot-password                                # Forgot Password
POST   /auth/login                                          # Login
POST   /auth/logout                                         # Logout
GET    /auth/me                                             # Get Me
PATCH  /auth/me                                             # Update Me
POST   /auth/refresh                                        # Refresh Token
POST   /auth/signup                                         # Signup
POST   /auth/social/authorize                               # Social Authorize
POST   /auth/social/exchange                                # Social Exchange
POST   /auth/social/id-token                                # Social Id Token
POST   /auth/social/role                                    # Social Set Role
```

## auto-bidding

```
GET   /businesses/me/auto-bid                               # Get Auto Bid
PUT   /businesses/me/auto-bid                               # Put Auto Bid
POST  /businesses/me/auto-bid/activate                      # Post Activate
POST  /businesses/me/auto-bid/dry-run                       # Post Dry Run
```

## booking-events

```
GET   /bookings/{booking_id}/events                         # List Events
POST  /bookings/{booking_id}/events                         # Create Event
```

## booking-location

```
GET     /bookings/{booking_id}/location                     # Get Location
PUT     /bookings/{booking_id}/location                     # Push Location
DELETE  /bookings/{booking_id}/location                     # Stop Sharing
```

## booking-photos

```
GET   /bookings/{booking_id}/photos                         # List Photos
POST  /bookings/{booking_id}/photos                         # Attach Photo
```

## bookings

```
GET    /bookings/                                           # List My Bookings
GET    /bookings/{booking_id}                               # Get Booking
POST   /bookings/{booking_id}/approve                       # Approve Completed Work
PATCH  /bookings/{booking_id}/assign-employee               # Assign Employee
GET    /bookings/{booking_id}/assignees                     # List Assignees
PATCH  /bookings/{booking_id}/cancel                        # Cancel Booking
PATCH  /bookings/{booking_id}/complete                      # Complete Booking
PATCH  /bookings/{booking_id}/confirm-date                  # Confirm Date
PATCH  /bookings/{booking_id}/propose-dates                 # Propose Dates
```

## businesses

```
GET    /businesses/                                         # List Businesses
POST   /businesses/                                         # Create Business
GET    /businesses/me                                       # Get My Business
GET    /businesses/me/analytics                             # Get My Analytics
GET    /businesses/nearby                                   # Get Nearby Businesses
GET    /businesses/{business_id}                            # Get Business
PATCH  /businesses/{business_id}                            # Update Business
```

## contact

```
POST  /contact/                                             # Submit Contact Form
```

## disputes

```
POST   /disputes/                                           # Create Dispute
GET    /disputes/admin/queue                                # Admin Dispute Queue
GET    /disputes/mine                                       # List My Disputes
PATCH  /disputes/{dispute_id}/resolve                       # Resolve Dispute
```

## employees

```
GET    /employees/                                          # List Employees
POST   /employees/                                          # Create Employee
GET    /employees/business/{business_id}                    # List Employees For Business
PATCH  /employees/{employee_id}                             # Update Employee
PATCH  /employees/{employee_id}/deactivate                  # Deactivate Employee
GET    /employees/{employee_id}/profile                     # Employee Profile
PATCH  /employees/{employee_id}/reactivate                  # Reactivate Employee
```

## google-reviews

```
GET     /google-reviews/business/{business_id}              # Get Imported Reviews
GET     /google-reviews/callback                            # Google Connect Bridge
POST    /google-reviews/callback                            # Finish Google Connect
POST    /google-reviews/connect                             # Start Google Connect
DELETE  /google-reviews/disconnect                          # Disconnect Google
POST    /google-reviews/import                              # Import Google Reviews
GET     /google-reviews/locations                           # List Google Locations
GET     /google-reviews/status                              # Google Reviews Status
```

## interests

```
POST   /interests/                                          # Express Interest
GET    /interests/mine                                      # List My Interests
GET    /interests/post/{post_id}                            # List Interests On Post
PATCH  /interests/{interest_id}/accept                      # Accept Interest
PATCH  /interests/{interest_id}/reject                      # Reject Interest
```

## invoices

```
GET  /bookings/{booking_id}/invoice                         # Get Invoice
GET  /bookings/{booking_id}/invoice.pdf                     # Get Invoice Pdf
```

## me

```
DELETE  /me                                                 # Delete My Account
GET     /me/auth-methods                                    # My Auth Methods
GET     /me/credits                                         # Get My Credits
GET     /me/export                                          # Export My Data
POST    /me/ghost                                           # Enter Ghost Mode
GET     /me/referrals                                       # Get My Referrals
POST    /me/unghost                                         # Leave Ghost Mode
```

## messages

```
POST  /messages/                                            # Send Message
GET   /messages/interest/{interest_id}                      # Get Interest Messages
POST  /messages/terms                                       # Propose Terms
POST  /messages/terms/{terms_id}/accept                     # Accept Terms
POST  /messages/terms/{terms_id}/withdraw                   # Withdraw Terms
GET   /messages/threads                                     # List Threads
GET   /messages/unread-count                                # Unread Count
GET   /messages/{booking_id}                                # Get Messages
```

## moderation

```
GET     /moderation/blocks                                  # List Blocks
POST    /moderation/blocks                                  # Create Block
GET     /moderation/blocks/check/{user_id}                  # Check Block
DELETE  /moderation/blocks/{user_id}                        # Remove Block
POST    /moderation/reports                                 # Create Report
GET     /moderation/reports/admin/queue                     # Admin Report Queue
GET     /moderation/reports/mine                            # List My Reports
PATCH   /moderation/reports/{report_id}/resolve             # Resolve Report
```

## payments

```
GET   /payments/mine                                        # List My Payments
POST  /payments/quote                                       # Quote Payment
GET   /payments/{booking_id}                                # Get Payment
```

## payments-offplatform

```
POST  /bookings/{booking_id}/mark-paid-offplatform          # Mark Paid Offplatform
```

## payments-stripe

```
POST    /payments/stripe/checkout/{booking_id}              # Create Checkout
POST    /payments/stripe/payment-intent/{booking_id}        # Create Payment Intent
POST    /payments/stripe/payment-intent/{booking_id}/confirm  # Confirm Payment Intent
GET     /payments/stripe/payment-methods                    # List Payment Methods
DELETE  /payments/stripe/payment-methods/{payment_method_id}  # Delete Payment Method
POST    /payments/stripe/setup-intent                       # Create Setup Intent
POST    /payments/stripe/webhook                            # Webhook
```

## payouts

```
GET   /businesses/me/payout-account                         # Get Payout Account
POST  /businesses/me/payout-account                         # Start Payout Onboarding
POST  /businesses/me/payout-account/login                   # Get Express Login Link
GET   /businesses/me/payouts                                # Get Wallet
POST  /businesses/me/payouts                                # Create Payout
```

## proof-of-work

```
GET     /bookings/{booking_id}/proof                        # Get Proof
POST    /bookings/{booking_id}/proof/approve                # Approve Proof
POST    /bookings/{booking_id}/proof/decline                # Decline Proof
POST    /bookings/{booking_id}/proof/submit                 # Submit Proof
PUT     /bookings/{booking_id}/proof/voice-note             # Put Voice Note
DELETE  /bookings/{booking_id}/proof/voice-note             # Delete Voice Note
```

## push-tokens

```
POST  /push-tokens/register                                 # Register Push Token
POST  /push-tokens/unregister                               # Unregister Push Token
```

## reviews

```
POST  /reviews/                                             # Create Review
GET   /reviews/business/{business_id}                       # Get Business Reviews
GET   /reviews/client/{client_id}                           # Get Client Reviews
GET   /reviews/employee/{employee_user_id}                  # Get Employee Reviews
```

## service-posts

```
GET     /service-posts/                                     # List Open Posts
POST    /service-posts/                                     # Create Service Post
GET     /service-posts/my                                   # List My Posts
GET     /service-posts/{post_id}                            # Get Service Post
PATCH   /service-posts/{post_id}                            # Update Service Post
DELETE  /service-posts/{post_id}                            # Cancel Service Post
```

## subscriptions

```
POST  /businesses/me/subscribe                              # Subscribe
GET   /businesses/me/subscription                           # My Subscription
```

## untagged

```
GET  /health                                                # Health Check
GET  /healthz                                               # Healthz
```

## uploads

```
POST    /uploads/audio                                      # Upload Audio
DELETE  /uploads/audio                                      # Delete Audio
POST    /uploads/image                                      # Upload Image
DELETE  /uploads/image                                      # Delete Image
```

## waitlist

```
POST  /waitlist/                                            # Join Waitlist
```

## Public / unauthenticated

Routes with no auth dependency, read from the code. Every entry here is deliberate; anything new appearing in this list is a finding.

```
GET     /docs
GET     /docs/oauth2-redirect
GET     /google-reviews/callback
GET     /health
GET     /healthz
GET     /openapi.json
GET     /redoc
POST    /auth/forgot-password
POST    /auth/login
POST    /auth/refresh
POST    /auth/signup
POST    /auth/social/authorize
POST    /auth/social/exchange
POST    /auth/social/id-token
POST    /contact/
POST    /payments/stripe/webhook
POST    /waitlist/
```
