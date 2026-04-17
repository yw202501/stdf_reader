#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose plugin is not available."
  echo "Install Docker Compose v2 (docker compose)."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running."
  echo "Start Docker service first, then retry."
  exit 1
fi

echo "Starting services with Docker Compose..."
docker compose up --build -d

echo ""
echo "Services are starting. Current status:"
docker compose ps

echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
