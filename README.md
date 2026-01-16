# AMS Flight Ingestion & Notification System

This project is a microservices-based system designed to ingest flight data from the Schiphol API, process updates via RabbitMQ, and notify users about flight delays through a full-stack application.

## Project Structure

```text
.
├── schiphol-api/       # Flight Data Ingestion Service (Source of Truth)
├── backend/            # User Notification Service (Express/Node.js logic)
├── frontend/           # Web Application (Next.js)
├── maps-api/           # Location-based Traffic Notifier
├── terraform/          # Infrastructure as Code (RabbitMQ Configuration)
├── sql/                # Database Initialization Scripts
├── docker-compose.yaml # Container Orchestration
├── package.json        # Root workspace scripts
└── .env                # Global Environment Variables
```

## Prerequisites

-   Docker or Podman installed.
-   Bun (v1.1.0 or higher) for JavaScript Runtime.

## Operation

### A. How to set up

1. Clone this repository
2. Environment Initialization

    The following command copies the `.env.example` file to `.env` in the root directory and establishes symbolic links for all sub-services (`schiphol-api`, `backend`, `frontend`) to ensure a SSoT for configuration.

    ```bash
    bun run setup
    ```

    Configuration Required: After initialization, the `.env` file in the root directory must be populated with valid credentials, specifically `SCHIPHOL_APP_ID` and `SCHIPHOL_APP_KEY`.

    **DO NOT fill in the API key in the `.env.example` file.**

3. Infrastructure & Application Startup

    The command below utilizes Docker Compose profiles to initialize all services, including the database, message queue, ingestion worker, backend API, and frontend application.

    ```bash
    bun run dev
    ```

    Upon successful execution, the following services will be available:

    - **Frontend**: http://localhost:3001
    - **Backend API**: http://localhost:3000
    - **RabbitMQ Console**: http://localhost:15672 (Credentials are defined in `.env`)

4. Infrastructure & Application Shutdown

    The command below shuts down all services.

    ```bash
    bun run stop
    ```

    The command below shuts down all services and removes volumes.

    ```bash
    bun run clean
    ```

## Development Workflow

A _Hybrid_ development workflow is adopted to maximize developer efficiency. Infrastructure components run within Docker containers, while application code is executed natively on the host machine to facilitate features such as Hot Module Replacement and Intellisense.

### Service Orchestration

The system is divided into two operational profiles:

-   Infra Profile: Core infrastructure (PostgreSQL, RabbitMQ, Terraform).
-   App Profile: Application containers (Ingestion, Backend, Frontend).

### Independent Service Development

To develop specific services natively while maintaining connectivity to the containerized infrastructure:

1. Initialize Infrastructure Only:

    ```bash
    docker compose --profile infra up -d
    ```

2. Execute Services Natively:

    - Schiphol API (Ingestion):

        ```bash
        cd schiphol-api && bun dev
        ```

    - Backend (Express.js):

        ```bash
        cd backend && bun dev
        ```

    - Frontend (Next.js):

        ```bash
        cd frontend && bun dev
        ```

### Service Reference

| Service     | Container Name             | Host Port | Internal Port | Description                                                              |
| ----------- | -------------------------- | --------- | ------------- | ------------------------------------------------------------------------ |
| PostgreSQL  | `flight_db`                | `5432`    | `5432`        | Persists flight data (flight_ingestion) and user data (flight_notifier). |
| RabbitMQ    | `flight_mq`                | `5672`    | `5672`        | AMQP Protocol Port for inter-service communication.                      |
| RabbitMQ UI | `flight_mq`                | `15672`   | `15672`       | Web-based management interface.                                          |
| Ingestion   | `flight_schiphol_api`      | N/A       | N/A           | Background worker service; exposes no HTTP port.                         |
| Backend     | `flight_notifier_backend`  | `3000`    | `3000`        | Express.js API handling user logic and notifications.                    |
| Frontend    | `flight_notifier_frontend` | `3001`    | `3001`        | Next.js web application.                                                 |
| MapsAPI     | `flight_maps_api`          | N/A       | `3002`        | Traffic notifier service; consumes traveler queue and publishes updates. |

## Flight Tracking Database

### Table Schema

| **Column**         | **Type**    | **Usage**                                                                                     |
| ------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `id`               | VARCHAR(50) | Primary Key, corresponding to Schiphol API's id                                               |
| `mainFlight`       | VARCHAR(20) | Business Key (Index), used for deduplication and linking historical records (e.g.`KL0808`)    |
| `flightName`       | VARCHAR(20) | Display flight number, corresponding to the name on the ticket (e.g.`KL808`)                  |
| `flightDirection`  | VARCHAR(1)  | A (Arrival) or D (Departure), determines time logic and notification type                     |
| `scheduleDate`     | VARCHAR(10) | Partition Key (Index), used for querying flights on specific dates (YYYY-MM-DD)               |
| `scheduleDateTime` | TIMESTAMPTZ | T0 (baseline time): scheduled time (STD/STA)                                                  |
| `estimatedTime`    | TIMESTAMPTZ | T1 (estimated time): normalized estimated time (Arr: ELDT, Dep: ETD)                          |
| `actualTime`       | TIMESTAMPTZ | T2 (actual time): normalized actual time (Arr: ALDT, Dep: ATD)                                |
| `lastUpdatedAt`    | TIMESTAMPTZ | Last update time from the data source (API), prevents processing stale data                   |
| `lastCheckedAt`    | TIMESTAMPTZ | Last checked time from the cron job to evaluate if application works as expected.             |
| `flightStates`     | TEXT        | Status tag array (comma-separated), such as EXP,ARR                                           |
| `gate`             | VARCHAR(10) | Boarding gate/arrival gate, used for detecting gate changes                                   |
| `terminal`         | INTEGER     | Terminal number                                                                               |
| `route`            | JSONB       | Stores destination array, EU status (eu), visa requirements (visa), and other structured data |
| `baggageClaim`     | JSONB       | Stores baggage carousel array (belts)                                                         |
| `createdAt`        | TIMESTAMPTZ | Records the time when this record was first created                                           |
| `updatedAt`        | TIMESTAMPTZ | Records the time when this record's status was last changed                                   |

### Validate if the Database is Established

1. Evaluate if the table exists

    ```bash
    docker exec -it flight_db psql -U admin -d flight_ingestion -c "\dt"
    ```

2. Evaluate if the table has the correct schema

    ```bash
    docker exec -it flight_db psql -U admin -d flight_ingestion -c "\d flight_state"
    ```

    The default column names of TypeORM may be camelCase `lastDelayMinutes` or snake_case `last_delay_minutes`, please refer to the result of `\d`.

### Validate if the Database is Populated

1.  Retrieve the list of databases

    ```bash
    docker exec -it flight_db psql -U admin -d postgres -c "\l"
    ```

2.  Enter into the `psql` database in Docker

    ```bash
    docker exec -it flight_db psql -U admin -d flight_ingestion
    ```

3.  Evaluate if the table has records (in `psql`)

    ```sql
    SELECT "mainFlight", "lastUpdatedAt", "lastCheckedAt" FROM flight_state ORDER BY "lastCheckedAt" DESC;
    ```

    Wait for the cron job to run, then reexecute the command above to evaluate if the table has updated the records. The `lastCheckedAt` should be updated.

4.  Health Check (in `psql`)

    This query is used to confirm whether the syncFlights job is running. If time_since_last_check is too large, it may indicate that the Cron Job has failed.

    ```sql
    SELECT
        COUNT(*) AS total_records,
        MAX("lastCheckedAt") AS last_sync_timestamp,
        NOW() - MAX("lastCheckedAt") AS time_since_last_check,
        COUNT(*) FILTER (WHERE "actualTime" IS NOT NULL) AS completed_flights
    FROM flight_state;
    ```

5.  Examine Delay Dashboard (in `psql`)

    This is used for examining delay flights. It is similar to the `DelayCalculator` logic in the application, selecting flights with a delay of more than 15 minutes. These flights are theoretically expected to trigger RabbitMQ events.

    ```sql
    SELECT "mainFlight", "flightDirection" AS dir, "scheduleDateTime",  "actualTime",
        FLOOR(EXTRACT(EPOCH FROM ("actualTime" - "scheduleDateTime")) / 60) AS delay_minutes,
        "route"->'destinations' AS destinations, "lastUpdatedAt"
    FROM flight_state
    WHERE
        "actualTime" IS NOT NULL
        AND "actualTime" > "scheduleDateTime" + INTERVAL '15 minutes'
    ORDER BY delay_minutes DESC;
    ```

6.  To confirm that delay notifications are being propagated to RabbitMQ

    ```bash
    docker exec -it flight_mq rabbitmqctl list_queues -p flight_ops
    ```

7.  If there are delayed flights, the number of messages in the `flight.delay_notifications` queue will increase. View it using the `watch` command.

    **Note: These parameters should correspond to the Terraform logic (`flight_mq`, `flight_ops`) and .env file (`MQ_USER`, `MQ_PASS`) settings**

    ```bash
    watch "docker exec -it flight_mq rabbitmqctl list_queues -p flight_ops"
    ```

    The output should be something like this

    ```
    +----------------------------+----------+
    |            name            | messages |
    +----------------------------+----------+
    | flight.delay_notifications | 1725     |
    +----------------------------+----------+
    ```

8.  In instances where RabbitMQ exchanges or queues fail to initialize correctly, the Terraform state may be reset

    a. To destroy existing resources

        ```bash
        docker exec -it flight_terraform terraform destroy -auto-approve
        ```

    b. To re-provision resources via container restart

        ```bash
        docker compose up -d terraform
        ```

### Schiphol API Unit Tests

1. Switch to the project directory
2. Run unit tests

    ```bash
    bun test          # Run once
    bun test --watch  # Run in background
    ```

    To test a specific file, add the file path, like

    ```bash
    bun test "./test/config/flight-schema.test.ts" --watch
    ```

    The terminal will show something akin to the following

    ```latex
    bun test v1.2.18 (0d4089ea)

    test/config/flight-schema.test.ts:
    ✓ Schiphol API Schema Validation > should parse the probed raw data successfully [5.13ms]
    ✓ Schiphol API Schema Validation > should fail when critical identity fields are missing [0.81ms]
    ✓ Schiphol API Schema Validation > should handle nullable fields correctly. e.g. Gate/Terminal [0.08ms]
    ...
    ✓ ChangeDetection > returns true if flight became delayed from on-time [0.01ms]
    ✓ ChangeDetection > returns false if delay is same
    ✓ ChangeDetection > returns false if both are 0 (on time)

    28 pass
    0 fail
    58 expect() calls
    Ran 28 tests across 4 files. [228.00ms]
    ```

    In normal circumstances, it should always display `pass`, if it fails, it means the code has a logical error that needs to be fixed. This will serve as a reference for future development "why correct".
