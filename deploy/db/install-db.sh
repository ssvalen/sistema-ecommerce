#!/usr/bin/env bash
# PostgreSQL en data1 o data2. Idempotente.
# Uso (root): install-db.sh primary | standby

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

ROLE="${1:-}"
[[ "$ROLE" == primary || "$ROLE" == standby ]] || die "Uso: install-db.sh primary|standby"

load_config
require_vars DATA1_IP DATA2_IP APP1_IP APP2_IP PG_VERSION CURRENT_PRIMARY DB_NAME DB_REPLICATOR_PASSWORD

SELF="$(hostname -s)"
case "$SELF" in
  data1) PEER=data2 ;;
  data2) PEER=data1 ;;
  *) die "install-db.sh solo corre en data1 o data2 (este nodo es '$SELF')" ;;
esac
SELF_IP="$(node_ip "$SELF")"
PEER_IP="$(node_ip "$PEER")"

PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"
PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"
PG_UNIT="postgresql@$PG_VERSION-main"

run_psql() {
  (cd /tmp && sudo -u postgres "$@")
}

log "Instalando PostgreSQL $PG_VERSION en $SELF ($ROLE)"
apt_install ssl-cert "postgresql-$PG_VERSION"
enable_time_sync
allow_nonlocal_bind

log "Configurando PostgreSQL"
cat >"$PG_CONF_DIR/conf.d/10-ecommerce.conf" <<EOF
# Generado por deploy/db/install-db.sh.
listen_addresses = 'localhost,$SELF_IP'
password_encryption = scram-sha-256
ssl = on
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
max_slot_wal_keep_size = 1GB
hot_standby = on
EOF
render_template "$DEPLOY_DIR/db/postgresql/pg_hba.conf.tpl" "$PG_CONF_DIR/pg_hba.conf"
chown postgres:postgres "$PG_CONF_DIR/conf.d/10-ecommerce.conf" "$PG_CONF_DIR/pg_hba.conf"
chmod 640 "$PG_CONF_DIR/pg_hba.conf"

systemd_restart_always "$PG_UNIT.service"
systemctl enable "$PG_UNIT" >/dev/null

PGPASS=/var/lib/postgresql/.pgpass
{
  printf '%s:5432:replication:replicator:%s\n' "$DATA1_IP" "$DB_REPLICATOR_PASSWORD"
  printf '%s:5432:replication:replicator:%s\n' "$DATA2_IP" "$DB_REPLICATOR_PASSWORD"
} >"$PGPASS"
chown postgres:postgres "$PGPASS"
chmod 600 "$PGPASS"

if [[ "$ROLE" == primary ]]; then
  systemctl restart "$PG_UNIT"

  log "Roles, base de datos y permisos"
  require_vars DB_OWNER_PASSWORD DB_APP_PASSWORD
  export DB_OWNER_PASSWORD DB_APP_PASSWORD
  run_psql --preserve-env=DB_OWNER_PASSWORD,DB_APP_PASSWORD \
    psql -v ON_ERROR_STOP=1 -q -d postgres -f "$DEPLOY_DIR/db/postgresql/roles.sql"

  log "Rol replicator y slot para $PEER"
  export DB_REPLICATOR_PASSWORD
  run_psql --preserve-env=DB_REPLICATOR_PASSWORD psql -v ON_ERROR_STOP=1 -q -d postgres <<SQL
\getenv replicator_password DB_REPLICATOR_PASSWORD
SELECT 'CREATE ROLE replicator WITH REPLICATION LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') \gexec
ALTER ROLE replicator WITH REPLICATION LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'replicator_password';
SELECT pg_create_physical_replication_slot('${PEER}_slot')
WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${PEER}_slot');
SQL
fi

if [[ "$ROLE" == standby ]]; then
  PRIMARY_IP="$(node_ip "$CURRENT_PRIMARY")"
  [[ "$PRIMARY_IP" != "$SELF_IP" ]] ||
    die "cluster.env dice que $SELF es el primario actual: no puede instalarse como réplica"

  if [[ -f "$PG_DATA_DIR/standby.signal" ]]; then
    log "$SELF ya es réplica: se conservan sus datos"
    systemctl restart "$PG_UNIT"
  else
    # No borrar nunca un primario con la base del sistema.
    systemctl start "$PG_UNIT"
    in_recovery="$(run_psql psql -tAqc 'SELECT pg_is_in_recovery()' -d postgres)"
    has_db="$(run_psql psql -tAqc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" -d postgres)"
    if [[ "$in_recovery" == f && "$has_db" == 1 ]]; then
      die "$SELF es primario y tiene la base '$DB_NAME'. Para convertirlo en réplica usa deploy/rebuild-standby.sh"
    fi

    log "pg_basebackup desde $CURRENT_PRIMARY ($PRIMARY_IP)"
    systemctl stop "$PG_UNIT"
    rm -rf "$PG_DATA_DIR"
    run_psql pg_basebackup \
      -d "host=$PRIMARY_IP user=replicator sslmode=require" \
      -D "$PG_DATA_DIR" -R -S "${SELF}_slot" -X stream --checkpoint=fast
    systemctl start "$PG_UNIT"
  fi
fi

log "Firewall"
firewall_base
firewall_allow_from "$APP1_IP" 5432
firewall_allow_from "$APP2_IP" 5432
firewall_allow_from "$PEER_IP" 5432
firewall_enable

log "Estado"
run_psql psql -d postgres -c 'SELECT pg_is_in_recovery() AS es_replica, current_setting($$ssl$$) AS ssl'
if [[ "$ROLE" == primary ]]; then
  run_psql psql -d postgres -c 'SELECT slot_name, active FROM pg_replication_slots'
  run_psql psql -d postgres -c 'SELECT client_addr, state, sync_state FROM pg_stat_replication'
else
  run_psql psql -d postgres -c 'SELECT status, sender_host FROM pg_stat_wal_receiver'
fi
log "PostgreSQL listo en $SELF ($ROLE)"
