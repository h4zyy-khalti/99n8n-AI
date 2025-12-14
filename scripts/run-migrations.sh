#!/bin/bash
# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head
echo "Migrations completed."

