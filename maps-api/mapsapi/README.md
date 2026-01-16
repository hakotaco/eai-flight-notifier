MapsAPI Traffic Notifier Service

What it does (final design):
- Listens on RabbitMQ for traveler messages pushed by the dashboard.
- Filters to travelers departing within the next N hours (default 4 via `POLL_WINDOW_HOURS`).
- Computes current road traffic from the traveler’s address to Amsterdam Airport Schiphol using Google Maps Directions API.
- Classifies traffic as regular or heavy (heavy if ETA is 25%+ slower than base or delay ≥ 15 minutes).
- Best‑effort: requests flight arrival info from Schiphol service via RabbitMQ RPC and includes it if available (continues without it if not).
- Publishes a traffic notification to the `traffic.notifications` fanout exchange for the dashboard/backend to consume.

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


Running locally (host mode)
Prerequisites: Node.js 18+ (Node 20 recommended), npm, and access to a RabbitMQ broker.

1) Configure environment (via `.env` in this folder or process env vars):
   - Required:
     - `GOOGLE_MAPS_API_KEY` — Directions + Geocoding must be enabled for this key.
     - `RABBITMQ_URL` — e.g. `amqp://user:pass@localhost:5672` (or your broker host).
   - Optional (defaults exist):
     - `RABBITMQ_EXCHANGE`, `DASHBOARD_TRAVELERS_QUEUE`, `SCHIPHOL_ARRIVAL_REQUEST_QUEUE`, `RPC_TIMEOUT_MS`, `POLL_WINDOW_HOURS`, `SCHIPHOL_ADDRESS`, `PORT`.

2) Install and start:
   - Windows PowerShell:
     - `cd C:\Users\alex\IdeaProjects\eai-flight-notifier\maps-api\mapsapi`
     - `npm install`
     - (optional) `$env:PORT = "3002"`
     - `npm run build`
     - `npm run start`
   - Health check: GET `http://localhost:3002/health` → `{ "ok": true }` (if `PORT=3002`).

Quick test with RabbitMQ
1) Ensure your RabbitMQ broker is running and accessible at `RABBITMQ_URL`.
2) Publish a traveler message to the input queue (`dashboard.travelers` by default):
   ```json
   {
     "id": "user-123",
     "address": "Dam Square, Amsterdam",
     "flightNumber": "KL1234",
     "departureTime": "<ISO timestamp within the next 4 hours>"
   }
   ```
3) Bind any queue to the fanout exchange `traffic.notifications` (or use your existing consumer) and observe one notification per traveler. If an RPC consumer listens on `schiphol.arrival.request`, the notification may include a `flightArrival` object; otherwise, that field is omitted.

Troubleshooting
- No notifications: make sure `departureTime` is within the next `POLL_WINDOW_HOURS` (default 4h).
- Maps API errors: verify `GOOGLE_MAPS_API_KEY` is set and Directions + Geocoding are enabled for the key.
- RabbitMQ connectivity: ensure `RABBITMQ_URL` points to a reachable broker and credentials are correct.
