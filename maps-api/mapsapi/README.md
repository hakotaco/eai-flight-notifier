MapsAPI Traffic Notifier Service (MQ-only)

What it does now (MQ-only design):
- Listens on RabbitMQ for traveler messages pushed by your dashboard.
- For travelers departing within the next N hours (default 4 via POLL_WINDOW_HOURS), computes current road traffic from the traveler’s address to Amsterdam Airport Schiphol using Google Maps Directions API.
- Classifies traffic as regular or heavy (heavy if ETA is 25%+ slower than base or delay ≥ 15 minutes).
- Requests flight arrival info from the Schiphol service via RabbitMQ RPC (best‑effort; continues if unavailable) and includes it with the traffic notification.
- Publishes a traffic notification to the `traffic.notifications` fanout exchange for the dashboard to consume.

Data handling:
- No traveler PII is stored locally. Traveler data is received transiently via RabbitMQ, used to compute and publish notifications, and then discarded.

RabbitMQ contract
- Inbound traveler messages (from dashboard):
  - Queue: `dashboard.travelers` (configurable via `DASHBOARD_TRAVELERS_QUEUE`)
  - Message shape (minimum):
    ```json
    {
      "id": "user-uuid",
      "name": "Optional Name",
      "email": "Optional Email",
      "address": "Street, City, Country",
      "flightNumber": "KL1234",
      "departureTime": "2026-01-12T13:45:00.000Z"
    }
    ```
  - Service filters travelers by departure within next `POLL_WINDOW_HOURS` before processing.

- RPC request to Schiphol service for arrival info:
  - Request queue: `schiphol.arrival.request` (configurable via `SCHIPHOL_ARRIVAL_REQUEST_QUEUE`)
  - AMQP RPC (reply-to + correlationId) with an exclusive auto-delete reply queue.
  - Request payload:
    ```json
    { "flightNumber": "KL1234", "date": "YYYY-MM-DD", "direction": "A" }
    ```
  - Response payload (example):
    ```json
    {
      "flightNumber": "KL1234",
      "scheduleDate": "2026-01-12",
      "scheduled": "2026-01-12T16:10:00.000Z",
      "estimated": "2026-01-12T16:35:00.000Z",
      "actual": null,
      "status": ["DELayed"],
      "gate": "E12",
      "terminal": "2",
      "lastUpdatedAt": "2026-01-12T12:05:00.000Z"
    }
    ```
  - Timeout is configurable via `RPC_TIMEOUT_MS` (default 8000ms). If the RPC times out or fails, the traffic notification is still published without `flightArrival`.

- Outbound traffic notifications (to dashboard):
  - Exchange: `traffic.notifications` (fanout, configurable via `RABBITMQ_EXCHANGE`)
  - Payload shape:
    ```json
    {
      "type": "TRAFFIC_NOTIFICATION",
      "payload": {
        "id": "notification-uuid",
        "createdAt": "2026-01-12T09:30:00.000Z",
        "userId": "user-uuid",
        "flightNumber": "KL1234",
        "origin": "Traveler Address",
        "destination": "Amsterdam Airport Schiphol",
        "traffic": {
          "status": "regular",
          "baseDurationSec": 1800,
          "trafficDurationSec": 2100,
          "delaySec": 300,
          "ratio": 1.17,
          "routeSummary": "A4"
        },
        "flightArrival": {
          "flightNumber": "KL1234",
          "scheduleDate": "2026-01-12",
          "scheduled": "2026-01-12T16:10:00.000Z",
          "estimated": "2026-01-12T16:35:00.000Z",
          "actual": null,
          "status": ["DELAYED"],
          "gate": "E12",
          "terminal": "2",
          "lastUpdatedAt": "2026-01-12T12:05:00.000Z"
        }
      }
    }
    ```

Environment (set via docker-compose or env file):
- `GOOGLE_MAPS_API_KEY` (required; enable Directions + Geocoding APIs)
- `RABBITMQ_URL` (default: `amqp://guest:guest@rabbitmq:5672`)
- `RABBITMQ_EXCHANGE` (default: `traffic.notifications`)
- `DASHBOARD_TRAVELERS_QUEUE` (default: `dashboard.travelers`)
- `SCHIPHOL_ARRIVAL_REQUEST_QUEUE` (default: `schiphol.arrival.request`)
- `RPC_TIMEOUT_MS` (default: 8000)
- `POLL_WINDOW_HOURS` (default: 4; only travelers departing within this window are processed)
- `SCHIPHOL_ADDRESS` (default: `Amsterdam Airport Schiphol`)

Run with Docker:
1. Set required envs (at least `GOOGLE_MAPS_API_KEY`).
2. `docker compose up --build`
3. RabbitMQ UI: http://localhost:15672 (guest/guest)

Local dev:
1. npm install
2. Set env vars in `.env` (same keys as above)
3. npm run dev

Notes:
- No HTTP server is exposed by this service in MQ-only mode.
- No local persistence: notifications are not stored on disk; they’re only published to RabbitMQ.
