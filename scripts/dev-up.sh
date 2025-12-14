#!/usr/bin/env bash
set -euo pipefail

# Build images
BACKEND_IMAGE=${BACKEND_IMAGE:-n8n-portal-backend}
FRONTEND_IMAGE=${FRONTEND_IMAGE:-n8n-portal-frontend}

echo "Building backend image: $BACKEND_IMAGE"
docker build -f Dockerfile.backend -t "$BACKEND_IMAGE" .

echo "Building frontend image: $FRONTEND_IMAGE"
docker build -f Dockerfile.frontend -t "$FRONTEND_IMAGE" .

# Run containers
BACKEND_CONTAINER=${BACKEND_CONTAINER:-n8n-portal-backend}
FRONTEND_CONTAINER=${FRONTEND_CONTAINER:-n8n-portal-frontend}

# Stop previous
(docker rm -f "$BACKEND_CONTAINER" || true) >/dev/null 2>&1
(docker rm -f "$FRONTEND_CONTAINER" || true) >/dev/null 2>&1

echo "Starting backend container..."
docker run -d --name "$BACKEND_CONTAINER" --env-file .env -p 4000:4000 "$BACKEND_IMAGE"

echo "Starting frontend container..."
docker run -d --name "$FRONTEND_CONTAINER" -p 3000:3000 "$FRONTEND_IMAGE"

echo "Done. Frontend: http://localhost:3000  Backend: http://localhost:4000"
