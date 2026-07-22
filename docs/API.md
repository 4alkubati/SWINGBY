---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy Backend API

Base URL: `http://127.0.0.1:8000` | Swagger: `/docs` | All routes require `Authorization: Bearer <token>` except signup/login/health/waitlist/contact.

## Auth
```
POST   /auth/signup
POST   /auth/login
POST   /auth/forgot-password
GET    /auth/me
PATCH  /auth/me
```

## Businesses
```
POST   /businesses/
GET    /businesses/
GET    /businesses/me
GET    /businesses/me/analytics            ← earnings, bookings, categories, reviews
GET    /businesses/nearby?lat=&lng=&radius_km=    ← Haversine geo-browse
GET    /businesses/{id}
PATCH  /businesses/{id}
```

## Employees
```
POST   /employees/
GET    /employees/
PATCH  /employees/{id}/deactivate
PATCH  /employees/{id}/reactivate
```

## Service Posts
```
POST   /service-posts/
GET    /service-posts/
GET    /service-posts/my
GET    /service-posts/{id}
DELETE /service-posts/{id}
```

## Interests
```
POST   /interests/
GET    /interests/post/{post_id}
PATCH  /interests/{id}/accept              ← creates booking + payment atomically
PATCH  /interests/{id}/reject
```

## Bookings
```
GET    /bookings/
GET    /bookings/{id}
PATCH  /bookings/{id}/assign-employee
PATCH  /bookings/{id}/confirm-date
PATCH  /bookings/{id}/complete
PATCH  /bookings/{id}/cancel
```

## Booking Events & Photos (live status)
```
POST   /booking-events/                    ← business posts status update
GET    /booking-events/{booking_id}
POST   /booking-photos/                    ← proof of work upload
GET    /booking-photos/{booking_id}
```

## Payments
```
GET    /payments/{booking_id}
POST   /payments/stripe/intent             ← Stripe sandbox
POST   /payments/stripe/webhook
```

## Reviews
```
POST   /reviews/
GET    /reviews/business/{business_id}
GET    /reviews/client/{client_id}
```

## Messages
```
POST   /messages/
GET    /messages/{booking_id}
```

## Push Tokens
```
POST   /push-tokens/                       ← register Expo push token
DELETE /push-tokens/{token}
```

## Admin
```
GET    /admin/users
GET    /admin/businesses
GET    /admin/bookings
```

## Public
```
POST   /waitlist/
POST   /contact/
GET    /health
```

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
