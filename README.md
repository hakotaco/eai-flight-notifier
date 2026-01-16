# Flight Delay & Traffic Notification System

A microservices-based system that monitors Schiphol flight data and sends users notifications about flight delays and traffic conditions for their journey to the airport.

## Quick Start

### Prerequisites

- Docker (with Docker Compose)

### Required API Keys

Before running the system, you need to obtain the following API keys and credentials:

**1. Schiphol API Credentials**
- Visit [Schiphol Developer Portal](https://developer.schiphol.nl/)
- Create an account and request API access
- Generate an App ID and App Key
- Add to `.env` as `SCHIPHOL_APP_ID` and `SCHIPHOL_APP_KEY`

**2. Google Maps API Key**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select an existing one
- Enable the following APIs:
  - Directions API
  - Geocoding API
- Generate an API key under "Credentials"
- Add to `.env` as `GOOGLE_MAPS_API_KEY`

**3. Gmail App Password**
- Go to your [Google Account settings](https://myaccount.google.com/security)
- Enable 2-Step Verification if not already enabled
- Search for "App passwords" in settings
- Generate a new app password for "Mail"
- Add to `.env` as `EMAIL_PASSWORD` (use your Gmail address for `EMAIL_USER`)

### Running the System

1. **Clone the repository and configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys (SCHIPHOL_APP_ID, SCHIPHOL_APP_KEY, GOOGLE_MAPS_API_KEY)
   ```

2. **Start infrastructure services (PostgreSQL, RabbitMQ):**
   ```bash
   docker compose --profile infra up -d
   ```
   Wait 10-15 seconds for RabbitMQ to fully initialize.

3. **Start application services:**
   ```bash
   docker compose --profile infra --profile app up
   ```

4. **Access the system:**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - RabbitMQ Management: http://localhost:16572 (admin/password)

You can now go to the frontend and sign up for flight delay notifications! 

### Stopping the System

```bash
docker compose --profile infra --profile app down
```

## Services Overview

### Infrastructure Services

**PostgreSQL (`flight_db`)**
- Stores flight data from Schiphol API in `flight_ingestion` database
- Stores user subscriptions and notifications in `flight_notifier` database
- Port: 5432

**RabbitMQ (`flight_mq`)**
- Message broker for inter-service communication
- Manages three main queues:
  - `flight.delayed` - Flight delay notifications from schiphol-api
  - `dashboard.travelers` - User signup notifications from backend
  - `traffic_updates` - Traffic notifications from maps-api
- Management UI: http://localhost:16572
- Port: 5672 (AMQP)

**Terraform (`flight_terraform`)**
- Configures RabbitMQ exchanges, queues, and bindings on startup
- Creates `flight_ops` vhost for flight event routing

### Application Services

**Schiphol API (`flight_schiphol_api`)**
- Polls Schiphol API every hour for flight updates
- Detects flight delays and publishes events to `flight.delayed` queue
- Stores flight states in PostgreSQL for change detection
- No exposed HTTP port (background worker)

**Backend (`flight_notifier_backend`)**
- Express.js API for user management and flight subscriptions
- Consumes flight delay events and sends email notifications
- Consumes traffic notifications and sends traffic alerts
- Publishes user signup events to `dashboard.travelers` queue for traffic checks
- Exposes REST API at http://localhost:3000
  - `POST /api/auth/signup` - User registration and flight subscription
  - `GET /api/users/travelers` - List all users with upcoming flights (used by maps-api)
  - `GET /health` - Health check

**Frontend (`flight_notifier_frontend`)**
- Next.js web application for user signup
- Allows users to subscribe to flight delay notifications
- Accessible at http://localhost:3001

**Maps API (`flight_maps_api`)**
- Monitors traffic conditions for users traveling to Schiphol Airport
- Two modes of operation:
  1. **Event-driven**: Checks traffic immediately when users sign up (if within 4-hour window)
  2. **Scheduled**: Polls backend every hour for all users approaching departure (within 4-hour window)
- Uses Google Maps API for traffic duration calculations
- Publishes traffic notifications to `traffic_updates` queue
- Exposes HTTP endpoints at http://localhost:3002
  - `GET /health` - Health check
  - `GET /notifications` - View sent notifications
  - `POST /check-now` - Manual traffic check trigger

## System Flow

1. User signs up via frontend with home address and flight number
2. Backend creates user subscription and publishes to `dashboard.travelers` queue
3. Maps-api receives signup, checks if flight is within 4 hours, and evaluates traffic
4. Schiphol-api periodically fetches flight updates and publishes delays to `flight.delayed` queue
5. Backend consumes both flight delays and traffic updates, sending email notifications to users
6. Maps-api scheduler runs hourly to catch users who signed up early but are now within 4-hour window

## Development

1.  To confirm that delay notifications are being propagated to RabbitMQ

    ```bash
    docker exec -it flight_mq rabbitmqctl list_queues -p flight_ops
    ```

2.  If there are delayed flights, the number of messages in the `flight.delay_notifications` queue will increase. View it using the `watch` command.

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

3.  In instances where RabbitMQ exchanges or queues fail to initialize correctly, the Terraform state may be reset

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
