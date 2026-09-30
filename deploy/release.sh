#!/usr/bin/env bash
# Publica la versión actual sin cortar el servicio: app1 (migra), luego app2, luego la SPA.
# Si una instancia no queda sana, se detiene y la otra sigue atendiendo.
# Uso (anfitrión, Git Bash): bash deploy/release.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v vagrant >/dev/null || { echo "ERROR: falta vagrant" >&2; exit 1; }

step() { printf '\n### %s\n' "$*"; }

step "app1: compilación, migraciones y reinicio"
vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/deploy-app.sh --migrate --spa"

step "app2: compilación y reinicio"
vagrant ssh app2 -c "sudo bash /vagrant/deploy/app/deploy-app.sh"

if [[ -f .release/spa/index.html ]]; then
  step "edge: publicando la SPA"
  vagrant ssh edge -c "sudo bash /vagrant/deploy/edge/publish-spa.sh"
fi

step "Versión publicada"
