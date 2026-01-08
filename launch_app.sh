#!/bin/bash
# Stop any old version running
docker stop spender || true
docker rm spender || true

# Run the container
# -d runs it in the background
# -p maps your Mac's port 3001 to the container's 3001
# -v mounts the local data directory for persistence
docker run -d \
  --name spender \
  -p 3001:3001 \
  -p 5173:5173 \
  -v "$(pwd)/server/data:/app/server/data" \
  spender

echo "Waiting for dev server to start..."
sleep 2

# Open the app in your default browser (Vite Dev Server)
open http://localhost:5173
