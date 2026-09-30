#!/usr/bin/env bash
# Funciones comunes. Uso: source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/vagrant}"
DEPLOY_DIR="$REPO_DIR/deploy"

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

log() { printf '\n==> %s\n' "$*"; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

trap 'printf "ERROR: falló el comando en la línea %s de %s\n" "$LINENO" "${BASH_SOURCE[0]}" >&2' ERR

require_root() {
  [[ $EUID -eq 0 ]] || die "Este script debe ejecutarse como root (sudo)."
}

# Exporta las variables de un archivo KEY=valor (sin CR de Windows).
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || die "Falta $file"
  set -a
  # shellcheck disable=SC1090
  source <(tr -d '\r' <"$file")
  set +a
}

load_config() {
  load_env_file "$DEPLOY_DIR/cluster.env"
  [[ -f "$DEPLOY_DIR/secrets.env" ]] ||
    die "Falta deploy/secrets.env. Genéralo en el anfitrión con: bash deploy/init-secrets.sh"
  load_env_file "$DEPLOY_DIR/secrets.env"
}

require_vars() {
  local name
  for name in "$@"; do
    [[ -n "${!name:-}" ]] || die "Falta la variable $name (revisa deploy/cluster.env y deploy/secrets.env)"
  done
}

# data1 → valor de DATA1_IP
node_ip() {
  local var
  var="$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')_IP"
  [[ -n "${!var:-}" ]] || die "No hay IP para el nodo '$1' en deploy/cluster.env"
  printf '%s' "${!var}"
}

apt_update_once() {
  if [[ -z "${_APT_UPDATED:-}" ]]; then
    apt-get -o DPkg::Lock::Timeout=300 update -q
    _APT_UPDATED=1
  fi
}

# El lock timeout cubre unattended-upgrades en el primer arranque.
apt_install() {
  apt_update_once
  apt-get -o DPkg::Lock::Timeout=300 install -y -q "$@"
}

# Reemplaza cada __VARIABLE__ por el valor de esa variable de entorno.
render_template() {
  local src="$1" dst="$2" content var
  content="$(<"$src")"
  while [[ "$content" =~ __([A-Z0-9_]+)__ ]]; do
    var="${BASH_REMATCH[1]}"
    [[ -n "${!var:-}" ]] || die "Falta la variable $var para la plantilla $src"
    content="${content//__${var}__/${!var}}"
  done
  printf '%s\n' "$content" >"$dst"
}

sha256_hex() {
  printf '%s' "$1" | sha256sum | cut -d' ' -f1
}

# SSH abierto: vagrant ssh entra por la interfaz NAT.
firewall_base() {
  apt_install ufw
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null
}

firewall_allow_from() {
  local ip="$1" port="$2"
  ufw allow from "$ip" to any port "$port" proto tcp >/dev/null
}

firewall_enable() {
  ufw --force enable >/dev/null
  ufw status verbose
}

systemd_restart_always() {
  local unit="$1"
  mkdir -p "/etc/systemd/system/$unit.d"
  cat >"/etc/systemd/system/$unit.d/10-ecommerce.conf" <<'EOF'
[Unit]
After=network-online.target
Wants=network-online.target

[Service]
Restart=always
RestartSec=2
EOF
  systemctl daemon-reload
}

# Los servicios escuchan en la IP privada, que puede no existir todavía al arrancar.
allow_nonlocal_bind() {
  printf 'net.ipv4.ip_nonlocal_bind = 1\n' >/etc/sysctl.d/60-ecommerce.conf
  sysctl -q -p /etc/sysctl.d/60-ecommerce.conf
}

enable_time_sync() {
  timedatectl set-ntp true || true
}

# Reinicia la API y espera a que /health responda 200 (la base debe estar disponible).
restart_api_and_wait() {
  local unit="$1" url="$2"
  systemctl restart "$unit"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      curl -sS "$url"
      echo
      return 0
    fi
    sleep 1
  done
  curl -sS -w '\nHTTP %{http_code}\n' "$url" || true
  systemctl --no-pager --lines=20 status "$unit" || true
  die "La API no respondió 200 en /health tras 30 s"
}
