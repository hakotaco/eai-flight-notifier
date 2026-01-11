#!/bin/bash

# Flight Notifier - Startup Script
# This script starts all services in the correct order

set -e  # Exit on error

echo "🚀 Starting Flight Notifier System..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please create .env from .env.example:"
    echo "  cp .env.example .env"
    exit 1
fi

print_status "Environment file found"

# Step 1: Clean up any existing containers
print_info "Cleaning up existing containers..."
docker compose down 2>/dev/null || true

# Step 2: Start infrastructure services
print_info "Starting infrastructure (PostgreSQL, RabbitMQ, Terraform)..."
docker compose --profile infra --profile app up -d db mq terraform

# Wait for services to be healthy
print_info "Waiting for database to be ready..."
timeout=60
counter=0
while ! docker compose exec -T db pg_isready -U admin -d postgres > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        print_error "Database failed to start within ${timeout}s"
        docker compose logs db
        exit 1
    fi
done
print_status "Database is ready"

print_info "Waiting for RabbitMQ to be ready..."
counter=0
while ! docker compose exec -T mq rabbitmq-diagnostics -q ping > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        print_error "RabbitMQ failed to start within ${timeout}s"
        docker compose logs mq
        exit 1
    fi
done
print_status "RabbitMQ is ready"

print_info "Waiting for Terraform to configure RabbitMQ..."
sleep 5
print_status "Terraform configuration complete"

# Step 3: Start application services
print_info "Starting application services (Schiphol API, Backend, Frontend)..."
docker compose --profile infra --profile app up -d schiphol-api backend frontend

print_status "All services started successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 Frontend:       http://localhost:3001"
echo "  🔧 Backend API:    http://localhost:3000"
echo "  🐰 RabbitMQ UI:    http://localhost:15672"
echo "  🗄️  PostgreSQL:     localhost:5432"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Useful commands:"
echo "  View logs:         docker compose logs -f [service-name]"
echo "  Stop all:          docker compose down"
echo "  Restart service:   docker compose restart [service-name]"
echo ""
print_info "To view all logs, run: docker compose logs -f"
