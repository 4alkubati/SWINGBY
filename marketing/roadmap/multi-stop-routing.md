---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# Roadmap: Multi-Stop Routing for Business Bookings

> Status: Planned — post-MVP  
> Owner: TBD  
> Dependencies: multiple confirmed bookings per day, native Maps integration

---

## Vision

An Uber-for-multiple-clients experience: when a business has 3+ bookings in a single day, SwingBy automatically builds an optimized driving route with chained stops — so the worker opens one screen and gets turn-by-turn navigation to each job in the optimal order.

---

## Use Cases

| # | Scenario |
|---|---|
| 1 | A cleaning company has 4 bookings spread across NW, SW, SE Calgary. Today they plan manually using Google Maps. SwingBy should hand them a single route. |
| 2 | A dog-walker has 6 drop-ins booked for Saturday. The route order affects their morning by 40+ minutes. |
| 3 | A handyman has 3 service calls — the app notifies them when to leave stop 1 to reach stop 2 on time. |
| 4 | A business owner assigns different employees to different stops within a shared route cluster. |

---

## MVP Scope

- **Trigger:** Employee opens "My day" view when ≥2 bookings are confirmed for today.
- **Route optimizer:** Nearest-neighbor heuristic (sufficient for 2–6 stops; no need for TSP solver at MVP scale).
- **Map rendering:** Deep-link to Apple Maps (`maps://`) or Google Maps (`comgooglemaps://`). Encoded as a waypoints URL (`?saddr=&daddr=&waypoints=`).
- **ETA display:** Show estimated arrival time per stop based on current location + routing.
- **Employee assignment:** Business owner can assign different employees to different stops from the booking management screen.
- **No turn-by-turn in-app:** Use OS navigation. SwingBy provides the ordered list and launches the app.

---

## Post-MVP Scope

- In-app turn-by-turn navigation overlay (MapKit / Google Maps SDK).
- Live location sharing with client ("worker is 10 min away").
- Dynamic re-routing when a booking is cancelled mid-day.
- Slack/webhook notifications when a stop is completed.
- Machine-learning route scoring based on traffic patterns over time.
- Multi-team routing: optimal split of a day's bookings across multiple employees.

---

## Technical Dependencies

| Dependency | Notes |
|---|---|
| `bookings.scheduled_time` column | Currently `scheduled_date` exists; time column needed for ordered routing |
| `bookings.employee_id` | Already exists ✓ |
| Address → lat/lng geocoding | Need Google Geocoding API call on booking creation (or Places autocomplete lat/lng saved from client side) |
| Apple Maps deep-link | `maps://?saddr=current+loc&daddr=<lat,lng>&waypoints=<lat1,lng1|lat2,lng2>` |
| Google Maps deep-link | `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...&travelmode=driving` |

---

## Apple Maps Deep-Link Pattern (reference)

```
maps://?saddr=Current+Location
       &daddr=51.0452,-114.0892          ← stop 1
       &waypoints=51.0286,-114.0931|51.0385,-114.0715  ← stops 2,3
       &dirflg=d
```

## Google Maps Deep-Link Pattern (reference)

```
https://www.google.com/maps/dir/?api=1
  &origin=current+location
  &destination=51.0452,-114.0892
  &waypoints=51.0286,-114.0931|51.0385,-114.0715
  &travelmode=driving
```

---

## Open Questions

- Do clients get a real-time "on the way" notification? (Scope for post-MVP.)
- Should stop order be editable by the worker (drag handles)?
- What happens when a new same-day booking is added after routing starts?

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
