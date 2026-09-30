#!/usr/bin/env bash
# Publica la versión actual de /vagrant en este nodo: copia, compila, migra (opcional),
# reinicia y espera a /health. Lo usan install-app.sh y release.sh.
# Uso (root): deploy-app.sh [--migrate] [--spa]

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

MIGRATE=false
SPA=false
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    --spa) SPA=true ;;
    *) die "Opción desconocida: $arg (uso: deploy-app.sh [--migrate] [--spa])" ;;
  esac
done

load_config
require_vars API_PORT

SELF="$(hostname -s)"
SELF_IP="$(node_ip "$SELF")"
SRC_DIR=/opt/ecommerce/src
UNIT="ecommerce-api@$API_PORT"
HEALTH_URL="http://$SELF_IP:$API_PORT/api/v1/health"

log "Copiando el código a $SRC_DIR"
# Fuera de /vagrant: en la carpeta compartida pnpm es lento y los symlinks fallan.
install -d -m 0755 "$SRC_DIR"
rsync -a --delete \
  --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' --exclude '.vagrant/' \
  --exclude '.release/' --exclude 'dev/.runtime/' --exclude 'backend/.env' \
  --exclude 'backend/src/generated/' --exclude 'deploy/secrets.env' \
  "$REPO_DIR/" "$SRC_DIR/"

log "Dependencias y compilación"
cd "$SRC_DIR"
pnpm install --frozen-lockfile
pnpm --filter @sistema-e/backend build

if $MIGRATE; then
  log "Migraciones (prisma migrate deploy)"
  (
    load_env_file /etc/ecommerce/migrate.env
    cd "$SRC_DIR/backend"
    pnpm exec prisma migrate deploy
  )

  log "Administrador (create-admin)"
  if [[ -n "${ADMIN_EMAIL:-}" ]]; then
    (
      load_env_file /etc/ecommerce/ecommerce.env
      cd "$SRC_DIR/backend"
      pnpm exec tsx scripts/create-admin.ts
    )
  else
    echo "Sin ADMIN_EMAIL en deploy/secrets.env: se omite."
  fi
fi

if $SPA && [[ -f "$SRC_DIR/frontend/package.json" ]]; then
  log "Compilando la SPA"
  pnpm --filter ./frontend build
  install -d "$REPO_DIR/.release/spa"
  rsync -a --delete "$SRC_DIR/frontend/dist/" "$REPO_DIR/.release/spa/"
fi

log "Reiniciando $UNIT"
# La unidad también se actualiza en cada release.
install -m 0644 "$DEPLOY_DIR/app/ecommerce-api@.service" /etc/systemd/system/ecommerce-api@.service
systemctl daemon-reload
restart_api_and_wait "$UNIT" "$HEALTH_URL"
log "API lista en $SELF"
