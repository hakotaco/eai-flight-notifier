MapsAPI Traffic Notifier Service (MQ‑only)

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

Run options
- Standalone (dev quickstart with its own RabbitMQ):
  1) Set `GOOGLE_MAPS_API_KEY`.
  2) In this folder: `docker compose up --build` (spins up a local RabbitMQ just for this service).
  3) RabbitMQ UI: http://localhost:15672 (guest/guest).
  4) Use the UI to publish test traveler messages to `dashboard.travelers`.

- Integrated with the main project (recommended for end‑to‑end):
  Run the root stack and point this service to the root RabbitMQ. See “End‑to‑end test procedure” below.

!!! End‑to‑end test procedure (final project)
1) Start Docker Desktop and ensure the engine is running.

2) From the project root, start infra and app services (RabbitMQ, DB, backend, Schiphol API):
   - Infra (RabbitMQ + Postgres + Terraform vhost setup):
     - `docker compose --profile infra up -d`
     - Wait for `mq` (RabbitMQ) to be healthy; Terraform will ensure the `flight_ops` vhost for flight events.

3) Start MapsAPI (this service) locally against the root RabbitMQ:
   - PowerShell (Windows):
     - `cd C:\Users\alex\IdeaProjects\eai-flight-notifier\maps-api\mapsapi`
     - `npm install`
     - Set envs (use your actual MQ credentials from the project `.env`):
       - `$env:GOOGLE_MAPS_API_KEY = "YOUR_MAPS_KEY"`
       - `$env:RABBITMQ_URL = "amqp://<MQ_USER>:<MQ_PASS>@localhost:5672"`
     - `npm run build`
     - `npm run start`
   Notes:
   - Running MapsAPI via its own Docker Compose will spin up a separate RabbitMQ and is not recommended for the integrated test. Running it as a local Node process is simplest for E2E.

4) Open RabbitMQ Management UI from the root stack: http://localhost:15672 and log in with your MQ credentials (from the project `.env`).
   - Ensure a queue (e.g., `traffic_updates`) is bound to the `traffic.notifications` fanout exchange (the backend service does this automatically at startup if configured with `TRAFFIC_UPDATES_QUEUE`).

5) Publish a test traveler message to the `dashboard.travelers` queue via the UI:
   ```json
   {
     "id": "user-123",
     "address": "Dam Square, Amsterdam",
     "flightNumber": "KL1234",
     "departureTime": "<an ISO time within the next 4 hours>"
   }
   ```
   - Tip: The service ignores travelers outside the next `POLL_WINDOW_HOURS` window.

6) Observe results:
   - MapsAPI logs should show a computed route and “Published traffic notification …”.
   - Backend logs should show “Received traffic update …” followed by “Traffic update processed and notification sent …”.
   - In RabbitMQ UI, the bound queue (e.g., `traffic_updates`) should receive one message for each traveler processed.
   - If a Schiphol RPC consumer is running on `schiphol.arrival.request`, notifications may include a `flightArrival` snapshot; otherwise that field is omitted by design.

Troubleshooting
- Docker named‑pipe or connection errors on Windows: start/restart Docker Desktop; verify with `docker info`.
- No notifications received: ensure `departureTime` is within the next `POLL_WINDOW_HOURS` (default 4h).
- Maps API failures: verify `GOOGLE_MAPS_API_KEY` is set and enabled for Directions + Geocoding; check quota/errors in logs.
- RabbitMQ connectivity: confirm `RABBITMQ_URL` matches the root broker (typically `amqp://<MQ_USER>:<MQ_PASS>@localhost:5672`).
