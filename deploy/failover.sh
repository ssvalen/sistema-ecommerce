#!/usr/bin/env bash
# Failover manual: aísla el primario, promueve la réplica y reapunta la API.
# Uso (anfitrión, Git Bash): bash deploy/failover.sh [--yes]

source "$(dirname "${BASH_SOURCE[0]}")/common/host.sh"

[[ "${1:-}" == --yes || -z "${1:-}" ]] || die "Uso: bash deploy/failover.sh [--yes]"

OLD="$(cluster_get CURRENT_PRIMARY)"
NEW="$(peer_of "$OLD")"

step "1/5 Réplica $NEW"
vm_running "$NEW" || die "$NEW no está encendida: no hay réplica que promover"
# Tras un failover a medias, este nodo ya es el primario viejo y aquí se detiene.
on_vm "$NEW" db/db-node.sh require-replica ||
  die "$NEW no es una réplica activa. Si el failover quedó a medias, reapunta la API con: vagrant ssh <app> -c 'sudo bash /vagrant/deploy/app/repoint-db.sh'"

[[ "${1:-}" == --yes ]] || confirm "¿Promover $NEW como primario en lugar de $OLD?"

step "2/5 Aislando el primario anterior ($OLD)"
if vm_running "$OLD"; then
  on_vm "$OLD" db/db-node.sh fence || info "No se pudo detener PostgreSQL en $OLD: no lo uses sin rebuild-standby.sh."
else
  info "$OLD está apagada. Al encenderla, reconstrúyela antes de cualquier otro uso:"
  info "bash deploy/rebuild-standby.sh $OLD"
fi

step "3/5 Promoviendo $NEW"
on_vm "$NEW" db/db-node.sh promote

step "4/5 cluster.env: CURRENT_PRIMARY=$NEW"
sed -i "s/^CURRENT_PRIMARY=.*/CURRENT_PRIMARY=$NEW/" "$CLUSTER_ENV"
[[ "$(cluster_get CURRENT_PRIMARY)" == "$NEW" ]] || die "No se pudo actualizar $CLUSTER_ENV"

step "5/5 Reapuntando la API (escalonado)"
pending=()
for app in app1 app2; do
  if ! vm_running "$app"; then
    pending+=("$app")
    continue
  fi
  on_vm "$app" app/repoint-db.sh ||
    die "$app no quedó sana. Reintenta con: vagrant ssh $app -c 'sudo bash /vagrant/deploy/app/repoint-db.sh'"
done

step "Failover completo: el primario es $NEW"
for app in "${pending[@]}"; do
  info "$app está apagada. Al encenderla: vagrant ssh $app -c 'sudo bash /vagrant/deploy/app/repoint-db.sh'"
done
info "El sistema queda sin réplica hasta: bash deploy/rebuild-standby.sh $OLD"
