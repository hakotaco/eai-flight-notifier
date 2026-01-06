# Flight Delay Notifier - Multi-Service Project

This project contains multiple services for the flight delay notification system.

## Project Structure

```
eai-central/
├── docker-compose.yml          # Orchestrates all services
├── backend/                    # Central service API
│   ├── src/                   # TypeScript source code
│   ├── package.json           # Backend dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── Dockerfile             # Backend container
│   └── init.sql               # Database schema
├── frontend/                   # Next.js web application
│   ├── app/                   # Next.js app router
│   ├── package.json           # Frontend dependencies
│   └── Dockerfile             # Frontend container
└── diagram/                    # UML diagrams (PlantUML/Mermaid)
```

## Services

### Running Services

All services are orchestrated via Docker Compose from the root directory:

```bash
# Start all services
docker compose up

# Start in detached mode
docker compose up -d

# Rebuild and start
docker compose up --build

# Stop all services
docker compose down

# View logs
docker compose logs [service-name]
```

### Current Services

1. **Backend (Central Service)** - Port 3000
   - Express.js API with TypeScript
   - Handles user signup and flight registration
   - Consumes RabbitMQ messages from external services
   - PostgreSQL database for persistence

2. **Frontend** - Port 3001
   - Next.js 14 with React Server Components
   - Tailwind CSS styling
   - User signup form

3. **PostgreSQL** - Port 5432
   - User and flight data storage
   - Notification schedules

4. **RabbitMQ** - Ports 5672, 15672
   - Message queue for flight and traffic updates
   - Management UI at http://localhost:15672

## Quick Start

```bash
# From project root
docker compose up

# Access services
# - Frontend: http://localhost:3001
# - Backend API: http://localhost:3000
# - RabbitMQ Management: http://localhost:15672 (guest/guest)
```

## Adding New Services

To add a new service (e.g., Schiphol polling service, Google Maps service):

1. Create a new folder in the root: `mkdir schiphol-service`
2. Add your service code and Dockerfile
3. Update `docker-compose.yml` to include the new service:

```yaml
  schiphol-service:
    build:
      context: ./schiphol-service
      dockerfile: Dockerfile
    depends_on:
      - rabbitmq
    environment:
      RABBITMQ_URL: amqp://rabbitmq:5672
```

## Development

Each service can be developed independently:

### Backend Development
```bash
cd backend
npm install
npm run dev  # Runs on port 3000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Runs on port 3001
```

## Environment Variables

Each service has its own `.env.example` file. Copy to `.env` or set via docker-compose.yml.
