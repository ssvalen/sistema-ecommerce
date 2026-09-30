#!/usr/bin/env bash
# Reconstruye un nodo como réplica del primario actual. Borra sus datos.
# Uso (anfitrión, Git Bash): bash deploy/rebuild-standby.sh data1|data2 [--yes]

source "$(dirname "${BASH_SOURCE[0]}")/common/host.sh"

NODE="${1:-}"
[[ "$NODE" == data1 || "$NODE" == data2 ]] || die "Uso: bash deploy/rebuild-standby.sh data1|data2 [--yes]"
PRIMARY="$(cluster_get CURRENT_PRIMARY)"
[[ "$NODE" != "$PRIMARY" ]] || die "$NODE es el primario actual (cluster.env): no se reconstruye"

vm_running "$PRIMARY" || die "El primario $PRIMARY no está encendido"
vm_running "$NODE" || die "Enciende $NODE primero: vagrant up $NODE"

[[ "${2:-}" == --yes ]] || confirm "Se borrarán los datos de PostgreSQL en $NODE. ¿Continuar?"

step "1/4 Deteniendo PostgreSQL en $NODE"
on_vm "$NODE" db/db-node.sh stop

# Los slots físicos no se replican: el primario necesita uno nuevo para esta réplica.
step "2/4 Slot ${NODE}_slot en $PRIMARY"
on_vm "$PRIMARY" db/db-node.sh slot "$NODE"

step "3/4 Copia desde $PRIMARY (pg_basebackup)"
on_vm "$NODE" db/db-node.sh rebuild

step "4/4 Replicación en $PRIMARY"
on_vm "$PRIMARY" db/db-node.sh status
step "$NODE es réplica de $PRIMARY"
