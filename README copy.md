# Demo ams-flight-ingestion

## Operation

### A. How to set up

1. Clone this repository
2. Create a `.env` file in the root directory

    ```bash
    cp -n ".env.example" ".env"
    ```

    And remember to fill in the API key in the `.env` file.

    **DO NOT fill in the API key in the `.env.example` file.**

3. Start the container.

    Since Terraform has been integrated into the container, `terraform init &&terraform apply` will be executed automatically.

    ```bash
    docker compose up -d
    ```

4. Install dependencies

    ```bash
    bun install
    ```

5. Run the script

    ```bash
    bun run src/index.ts
    ```

### B. How to stop

1. Stop the container

    ```bash
    docker compose down
    ```

2. Destroy Terraform Resources for troubleshooting. e.g. DNS issue.

    ```bash
    docker exec -it flight_terraform terraform destroy -auto-approve
    docker compose down -v
    ```

    Then restart the container with `--build` option.

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

1. Enter into the `psql` database in Docker

    ```bash
    docker exec -it flight_db psql -U admin -d flight_ingestion
    ```

2. Evaluate if the table has records (in `psql`)

    ```sql
    SELECT "mainFlight", "lastUpdatedAt", "lastCheckedAt" FROM flight_state ORDER BY "lastCheckedAt" DESC;
    ```

    Wait for the cron job to run, then reexecute the command above to evaluate if the table has updated the records. The `lastCheckedAt` should be updated.

3. Health Check (in `psql`)

    This query is used to confirm whether the syncFlights job is running. If time_since_last_check is too large, it may indicate that the Cron Job has failed.

    ```sql
    SELECT
        COUNT(*) AS total_records,
        MAX("lastCheckedAt") AS last_sync_timestamp,
        NOW() - MAX("lastCheckedAt") AS time_since_last_check,
        COUNT(*) FILTER (WHERE "actualTime" IS NOT NULL) AS completed_flights
    FROM flight_state;
    ```

4. Examine Delay Dashboard (in `psql`)

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

5. If there are delayed flights, the number of messages in the `flight.delay_notifications` queue will increase. You can use the `watch` command to view it.

    **Note: These parameters should correspond to the Terraform logic (`flight-mq`, `flight_ops`) and .env file (`MQ_USER`, `MQ_PASS`) settings**

    ```bash
    watch docker exec -it flight-mq ${MQ_USER} -p ${MQ_PASS} -V flight_ops list queues
    ```

    The output should be something like this

    ```
    +----------------------------+----------+
    |            name            | messages |
    +----------------------------+----------+
    | flight.delay_notifications | 1725     |
    +----------------------------+----------+
    ```

### Unit Tests

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
