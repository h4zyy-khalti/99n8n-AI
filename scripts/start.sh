#!/bin/bash
set -e

DB_NAME=${POSTGRES_DB:-n8n_db}
DB_USER=${POSTGRES_USER:-n8n_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-n8n_password}

echo "Waiting for PostgreSQL to be ready..."
# Wait for postgres to be ready
until PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready. Running migrations..."
# Mark migration as applied if tables already exist (from init-db.sql)
if PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles');" | grep -q t; then
    echo "Tables already exist from init-db.sql. Stamping migration..."
    alembic stamp head || true
else
    echo "Running migrations..."
    alembic upgrade head
fi

echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port 4000

