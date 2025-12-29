#!/bin/bash

# Setup Test Database Script
# This script sets up the test database for integration tests

set -e

echo "🚀 Setting up test database..."

# Start test database
echo "📦 Starting PostgreSQL test container..."
docker-compose --profile test up -d postgres-test

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if database is ready
until docker-compose exec -T postgres-test pg_isready -U postgres > /dev/null 2>&1; do
    echo "⏳ Waiting for database..."
    sleep 2
done

echo "✅ Database is ready!"

# Run migrations
echo "🔄 Running migrations..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hyperliquid_grid_bot_test" pnpm db:push

echo "✅ Test database setup complete!"
echo ""
echo "Database connection:"
echo "  Host: localhost"
echo "  Port: 5433"
echo "  Database: hyperliquid_grid_bot_test"
echo "  User: postgres"
echo "  Password: postgres"
echo ""
echo "Run tests with: pnpm test:integration"
echo "Stop database with: docker-compose --profile test down"

