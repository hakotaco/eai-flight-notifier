MapsAPI Traffic Notifier Service (TypeScript)

What it does:
- Every hour polls the current road traffic from each traveler’s address to Amsterdam Airport Schiphol using Google Maps Directions API.
- Classifies traffic as regular or heavy (heavy if ETA is 25%+ slower than base or delay ≥ 15 minutes).
- Publishes a traffic notification to RabbitMQ for your main app.
- Exposes a minimal HTTP API and runs in Docker together with RabbitMQ.
- Only checks travelers whose departure time is within the next N hours (default 4), configurable via POLL_WINDOW_HOURS.

Important data handling changes:
- This service does NOT store user PII locally (name, email). Travelers are fetched from your main dashboard at runtime.
- The  dashboard provides: id, name, email, address, flightNumber, and departure date/time. The service uses these transiently but does not persist any PII.

HTTP API:
- GET /health
- GET /notifications
- POST /check-now (manual trigger; fetches travelers from dashboard and runs checks immediately)

How traffic is calculated and scheduled (short):
- Traffic calculation (Google Maps): `src/services/googleMaps.ts` → `GoogleMapsClient.assessTraffic(origin, destination)`
    - Calls Google Directions API with `departure_time=now` and `traffic_model=best_guess`, picks the route with the smallest `duration_in_traffic`, and classifies as `heavy` if ETA ≥ 25% slower or delay ≥ 15 minutes; else `regular`.
- Scheduler: `src/scheduler.ts` → `startScheduler()`
    - Runs once at startup, then on cron `POLL_CRON` (default hourly). Fetches users from `DASHBOARD_USERS_URL`, filters those departing within `POLL_WINDOW_HOURS`, and for each user calls `TrafficService.checkUser` to create a notification and publish it to RabbitMQ (`RABBITMQ_EXCHANGE`).

Environment (see .env.example):
- GOOGLE_MAPS_API_KEY (required; enable Directions + Geocoding APIs)
- DASHBOARD_USERS_URL (URL returning an array like [{ id, name, email, address, flightNumber, departureTime }]; departureTime may be ISO or epoch and is normalized)
- RABBITMQ_URL (default: amqp://guest:guest@rabbitmq:5672)
- RABBITMQ_EXCHANGE (default: traffic.notifications)
- PORT (default: 3000)
- POLL_CRON (default: 0 * * * *)
- POLL_WINDOW_HOURS (default: 4; only travelers departing within this window are checked)
- SCHIPHOL_ADDRESS (default: Amsterdam Airport Schiphol)

Run with Docker:
1. Copy .env.example to .env and set GOOGLE_MAPS_API_KEY and DASHBOARD_USERS_URL.
2. Start the stack:
    - `docker compose up --build`
    - Optional logs: `docker compose logs -f mapsapi`
3. What you should see in logs:
    - `HTTP server listening on :3000`
    - `[Scheduler] Started with cron '0 * * * *'`
    - An initial run (may say no users if the window/filter doesn’t match)
4. Verify:
    - Service health: http://localhost:3000/health → `{ ok: true }`
    - Recent notifications: http://localhost:3000/notifications
    - RabbitMQ UI: http://localhost:15672 (guest/guest)
      Notes:
- Notifications are persisted under ./data (notifications.json) — no user PII is stored.
- Notifications are also published to RabbitMQ exchange traffic.notifications (fanout).
- Scheduler runs once at startup and then on the cron schedule.
- PostgreSQL integration is deferred for now; travelers are fetched from DASHBOARD_USERS_URL. When DB details are available, this service can switch to querying the DB directly.
