#!/usr/bin/env bash
# Prepara app1 o app2 (Node, pnpm, usuario, configuración, systemd, firewall) y publica la API.
# Idempotente. Uso (root): install-app.sh api-1|api-2 [--migrate]

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

INSTANCE_ID="${1:-}"
MIGRATE="${2:-}"
[[ "$INSTANCE_ID" =~ ^api-[0-9]+$ ]] || die "Uso: install-app.sh api-1|api-2 [--migrate]"

load_config
require_vars EDGE_IP DATA2_IP CURRENT_PRIMARY API_PORT DB_NAME NODE_MAJOR PNPM_VERSION \
  DB_APP_PASSWORD DB_OWNER_PASSWORD REDIS_APP_PASSWORD JWT_SECRET

SELF="$(hostname -s)"
[[ "$SELF" == app1 || "$SELF" == app2 ]] || die "install-app.sh corre en app1 o app2 (este nodo es '$SELF')"
SELF_IP="$(node_ip "$SELF")"
PRIMARY_IP="$(node_ip "$CURRENT_PRIMARY")"

APP_ROOT=/opt/ecommerce
UNIT="ecommerce-api@$API_PORT"

log "Paquetes base"
apt_install ca-certificates curl gnupg rsync
enable_time_sync
allow_nonlocal_bind

log "Node.js $NODE_MAJOR (NodeSource)"
if ! node --version 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    >/etc/apt/sources.list.d/nodesource.list
  _APT_UPDATED=
  apt_install nodejs
fi
node --version

log "pnpm $PNPM_VERSION"
if [[ "$(pnpm --version 2>/dev/null || true)" != "$PNPM_VERSION" ]]; then
  npm install -g --no-fund --no-audit "pnpm@$PNPM_VERSION"
fi
pnpm --version

log "Usuario y directorios"
id ecommerce &>/dev/null ||
  useradd --system --home-dir "$APP_ROOT" --no-create-home --shell /usr/sbin/nologin ecommerce
install -d -m 0755 "$APP_ROOT"
install -d -m 0750 -o root -g ecommerce /etc/ecommerce

log "Configuración (/etc/ecommerce)"
cat >/etc/ecommerce/ecommerce.env <<EOF
# Generado por deploy/app/install-app.sh.
NODE_ENV=production
HOST=$SELF_IP
INSTANCE_ID=$INSTANCE_ID
LOG_LEVEL=info
TRUST_PROXY=$EDGE_IP
DATABASE_URL=postgresql://ecommerce_app:$DB_APP_PASSWORD@$PRIMARY_IP:5432/$DB_NAME
DB_SSL_MODE=require
DB_POOL_MAX=10
REDIS_URL=redis://ecommerce_app:$REDIS_APP_PASSWORD@$DATA2_IP:6379/0
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7200
COOKIE_SECURE=true
EOF
chown root:ecommerce /etc/ecommerce/ecommerce.env
chmod 0640 /etc/ecommerce/ecommerce.env

# Credenciales del owner: solo root, solo para migrar.
cat >/etc/ecommerce/migrate.env <<EOF
MIGRATE_DATABASE_URL=postgresql://ecommerce_owner:$DB_OWNER_PASSWORD@$PRIMARY_IP:5432/$DB_NAME?sslmode=require
DB_SSL_MODE=require
EOF
chown root:root /etc/ecommerce/migrate.env
chmod 0600 /etc/ecommerce/migrate.env

log "Servicio $UNIT"
install -m 0644 "$DEPLOY_DIR/app/ecommerce-api@.service" /etc/systemd/system/ecommerce-api@.service
systemctl daemon-reload
systemctl enable "$UNIT" >/dev/null

log "Firewall"
firewall_base
firewall_allow_from "$EDGE_IP" "$API_PORT"
firewall_enable

bash "$DEPLOY_DIR/app/deploy-app.sh" ${MIGRATE:+"$MIGRATE"}
log "API instalada en $SELF ($INSTANCE_ID)"
