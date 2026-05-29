/**
 * T87 — k6 load test for GET /businesses/nearby
 *
 * Load test for the nearby businesses endpoint.
 *
 * HOW TO RUN:
 *   k6 run backend/tests/k6/nearby_load.js
 *
 * Or with custom BASE_URL:
 *   k6 run -e BASE_URL=http://localhost:8000 backend/tests/k6/nearby_load.js
 *
 * CONFIGURATION:
 * - Duration: 60 seconds total
 * - Stages: 10s ramp up (0 → 100 RPS), 40s steady (100 RPS), 10s ramp down (100 → 0)
 * - Target: 100 RPS average
 * - Thresholds:
 *   * p95 latency < 1500ms
 *   * HTTP error rate < 5%
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://swingbyy-api.onrender.com";

export let options = {
  // Stages: ramp up, steady, ramp down
  stages: [
    { duration: "10s", target: 100 },  // Ramp-up to 100 RPS over 10s
    { duration: "40s", target: 100 },  // Steady at 100 RPS for 40s
    { duration: "10s", target: 0 },    // Ramp-down to 0 RPS over 10s
  ],

  // Thresholds for pass/fail
  thresholds: {
    "http_req_duration": ["p(95)<1500"],  // 95th percentile must be < 1500ms
    "http_req_failed": ["rate<0.05"],     // Error rate must be < 5%
  },
};

export default function () {
  // Query parameters for Calgary area
  const lat = 51.0447;
  const lng = -114.0719;
  const radius_km = 10;

  const url = `${BASE_URL}/businesses/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}`;

  // Make the request
  let res = http.get(url);

  // Validation checks
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 1500ms": (r) => r.timings.duration < 1500,
    "body is not empty": (r) => r.body.length > 0,
  });

  // Small sleep between requests (simulates realistic client behavior)
  sleep(0.1);
}
