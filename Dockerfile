FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Node.js (for building/serving React)
RUN apt-get update && apt-get install -y curl gnupg ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Backend deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Frontend deps and build
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm ci && npm i -g serve
COPY frontend /app/frontend
RUN cd /app/frontend && npm run build

# App source
COPY . /app

# Ports: 3000 (frontend), 4000 (backend)
EXPOSE 3000 4000

# Run both frontend (static) and backend
CMD bash -lc "\
  serve -s /app/frontend/build -l 3000 & \
  uvicorn main:app --host 0.0.0.0 --port 4000"
