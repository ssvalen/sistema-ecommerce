#!/usr/bin/env bash
# Funciones de los scripts del anfitrión (Git Bash). Uso: source deploy/common/host.sh

set -Eeuo pipefail
# vagrant.exe recibe los argumentos tal cual, sin conversión de rutas de MSYS.
export MSYS_NO_PATHCONV=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
CLUSTER_ENV=deploy/cluster.env
SECRETS_ENV=deploy/secrets.env

step() { printf '\n### %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v vagrant >/dev/null || die "Falta vagrant"

# Valor de una clave en un archivo KEY=valor.
env_get() {
  tr -d '\r' <"$1" | sed -n "s/^$2=//p" | tail -n 1
}

cluster_get() { env_get "$CLUSTER_ENV" "$1"; }

peer_of() {
  case "$1" in
    data1) printf data2 ;;
    data2) printf data1 ;;
    *) die "Nodo de base de datos desconocido: '$1'" ;;
  esac
}

vm_running() {
  # Sin grep -q: con pipefail, el SIGPIPE de tr daría un falso negativo.
  [[ "$(vagrant status "$1" --machine-readable 2>/dev/null | tr -d '\r')" == *",state,running"* ]]
}

clean_output() {
  tr -d '\r' | sed -E 's|\x1b\[[0-9;?<>=]*[ -/]*[@-~]||g; s|\x1b\][^\x07]*\x07||g; s|\x1b[=>]||g'
}

# Ejecuta un script de deploy/ como root en la VM.
on_vm() {
  local vm="$1"
  shift
  vagrant ssh "$vm" --no-tty -c "sudo bash /vagrant/deploy/$*" | clean_output
}

on_vm_raw() {
  vagrant ssh "$1" --no-tty -c "$2" | clean_output
}

confirm() {
  local answer
  read -r -p "$1 [s/N] " answer
  [[ "$answer" =~ ^[sS]$ ]] || die "Cancelado"
}
