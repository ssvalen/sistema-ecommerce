#!/usr/bin/env bash
# Genera deploy/secrets.env si no existe. Uso (Git Bash): bash deploy/init-secrets.sh
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$DEPLOY_DIR/secrets.env"

if [[ -f "$TARGET" ]]; then
  echo "deploy/secrets.env ya existe: no se modifica."
  exit 0
fi

random_secret() {
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

umask 077
cat > "$TARGET" <<EOF
DB_OWNER_PASSWORD=$(random_secret)
DB_APP_PASSWORD=$(random_secret)
DB_REPLICATOR_PASSWORD=$(random_secret)
REDIS_ADMIN_PASSWORD=$(random_secret)
REDIS_APP_PASSWORD=$(random_secret)
JWT_SECRET=$(random_secret)
EOF

echo "Generado deploy/secrets.env"
