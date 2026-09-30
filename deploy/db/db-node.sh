#!/usr/bin/env bash
# Operaciones de PostgreSQL en data1/data2 para failover.sh, rebuild-standby.sh y demo.sh.
# Uso (root): db-node.sh status | require-replica | fence | promote | stop | slot <nodo> | rebuild
#             db-node.sh pick-product | stock <id> | exists products|orders <id>

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

load_config
require_vars PG_VERSION CURRENT_PRIMARY DB_NAME

SELF="$(hostname -s)"
[[ "$SELF" == data1 || "$SELF" == data2 ]] || die "db-node.sh corre en data1 o data2 (este nodo es '$SELF')"

PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"
PG_UNIT="postgresql@$PG_VERSION-main"

sql() {
  (cd /tmp && sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q "$@")
}

in_recovery() {
  sql -d postgres -tAc 'SELECT pg_is_in_recovery()'
}

require_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]] || die "Se esperaba un número entero: '${1:-}'"
}

show_status() {
  if [[ "$(in_recovery)" == t ]]; then
    echo "$SELF: réplica"
    sql -d postgres -c "SELECT status, sender_host FROM pg_stat_wal_receiver"
    sql -d postgres -c "SELECT pg_last_wal_receive_lsn() AS recibido, pg_last_wal_replay_lsn() AS aplicado,
      now() - pg_last_xact_replay_timestamp() AS desde_ultima_transaccion"
  else
    echo "$SELF: primario"
    sql -d postgres -c "SELECT slot_name, active FROM pg_replication_slots"
    sql -d postgres -c "SELECT client_addr, state, sync_state, write_lag, replay_lag FROM pg_stat_replication"
  fi
}

case "${1:-}" in
  status)
    show_status
    ;;

  require-replica)
    systemctl is-active --quiet "$PG_UNIT" || die "PostgreSQL no está activo en $SELF"
    [[ "$(in_recovery)" == t ]] || die "$SELF no es réplica"
    show_status
    ;;

  fence)
    systemctl stop "$PG_UNIT"
    systemctl mask "$PG_UNIT"
    echo "PostgreSQL detenido y enmascarado en $SELF"
    ;;

  promote)
    if [[ "$(in_recovery)" == f ]]; then
      echo "$SELF ya es primario"
    else
      [[ "$(sql -d postgres -tAc 'SELECT pg_promote(true, 60)')" == t ]] || die "pg_promote no terminó en 60 s"
    fi
    [[ "$(in_recovery)" == f ]] || die "$SELF sigue en recuperación"
    echo "$SELF es el nuevo primario"
    ;;

  stop)
    systemctl unmask "$PG_UNIT"
    systemctl stop "$PG_UNIT"
    echo "PostgreSQL detenido en $SELF"
    ;;

  slot)
    NODE="${2:-}"
    [[ "$NODE" == data1 || "$NODE" == data2 ]] && [[ "$NODE" != "$SELF" ]] || die "Uso: db-node.sh slot <otro nodo>"
    [[ "$(in_recovery)" == f ]] || die "$SELF no es primario"
    # Slot nuevo: retiene WAL desde ahora para la réplica que se va a copiar.
    sql -d postgres <<SQL
SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots
WHERE slot_name = '${NODE}_slot' AND NOT active;
SELECT pg_create_physical_replication_slot('${NODE}_slot')
WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${NODE}_slot');
SQL
    sql -d postgres -c "SELECT slot_name, active FROM pg_replication_slots"
    ;;

  rebuild)
    [[ "$CURRENT_PRIMARY" != "$SELF" ]] || die "cluster.env dice que $SELF es el primario: no se reconstruye"
    PRIMARY_IP="$(node_ip "$CURRENT_PRIMARY")"
    systemctl unmask "$PG_UNIT"
    systemctl stop "$PG_UNIT"
    rm -rf "$PG_DATA_DIR"
    (cd /tmp && sudo -u postgres pg_basebackup \
      -d "host=$PRIMARY_IP user=replicator sslmode=require" \
      -D "$PG_DATA_DIR" -R -S "${SELF}_slot" -X stream --checkpoint=fast)
    systemctl start "$PG_UNIT"
    show_status
    ;;

  pick-product)
    sql -d "$DB_NAME" -tAc "SELECT id FROM products WHERE deleted_at IS NULL AND stock >= 2
      ORDER BY units_sold DESC, id LIMIT 1"
    ;;

  stock)
    require_int "${2:-}"
    sql -d "$DB_NAME" -tAc "SELECT stock FROM products WHERE id = $2"
    ;;

  exists)
    [[ "${2:-}" == products || "${2:-}" == orders ]] || die "Uso: db-node.sh exists products|orders <id>"
    require_int "${3:-}"
    sql -d "$DB_NAME" -tAc "SELECT count(*) FROM $2 WHERE id = $3"
    ;;

  *)
    die "Uso: db-node.sh status | require-replica | fence | promote | stop | slot <nodo> | rebuild | pick-product | stock <id> | exists products|orders <id>"
    ;;
esac
