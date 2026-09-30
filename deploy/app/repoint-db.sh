#!/usr/bin/env bash
# Apunta la API al primario de cluster.env y la reinicia. Lo usa failover.sh.
# Uso (anfitrión): vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/repoint-db.sh"

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

load_config
require_vars CURRENT_PRIMARY API_PORT

SELF="$(hostname -s)"
SELF_IP="$(node_ip "$SELF")"
PRIMARY_IP="$(node_ip "$CURRENT_PRIMARY")"
UNIT="ecommerce-api@$API_PORT"

log "$SELF: base de datos en $CURRENT_PRIMARY ($PRIMARY_IP)"
for file in /etc/ecommerce/ecommerce.env /etc/ecommerce/migrate.env; do
  [[ -f "$file" ]] || die "Falta $file (¿se instaló la API con install-app.sh?)"
  sed -i -E "s#@[0-9.]+:5432/#@$PRIMARY_IP:5432/#" "$file"
done
grep -E '^(DATABASE_URL|MIGRATE_DATABASE_URL)=' /etc/ecommerce/*.env | sed -E 's#://([^:]+):[^@]+@#://\1:***@#'

log "Reiniciando $UNIT"
restart_api_and_wait "$UNIT" "http://$SELF_IP:$API_PORT/api/v1/health"
