#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
docker compose up -d --build
printf '%s\n' 'Dévoilé Essentials deployed on port 8090.'
