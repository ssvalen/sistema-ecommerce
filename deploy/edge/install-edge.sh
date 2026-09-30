#!/usr/bin/env bash
# NGINX en edge: TLS, SPA, balanceo hacia app1/app2 y caché de imágenes. Idempotente.
# Uso (root): install-edge.sh

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

load_config
require_vars EDGE_IP APP1_IP APP2_IP API_PORT

[[ "$(hostname -s)" == edge ]] || die "install-edge.sh corre en edge (este nodo es '$(hostname -s)')"

WEB_ROOT=/var/www/ecommerce
TLS_DIR=/etc/nginx/tls

log "Instalando NGINX"
apt_install nginx openssl rsync
enable_time_sync

log "Certificado TLS autofirmado"
install -d -m 0750 "$TLS_DIR"
if [[ ! -f "$TLS_DIR/ecommerce.crt" ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -subj "/CN=sistema-e" \
    -addext "subjectAltName=IP:$EDGE_IP,DNS:sistema-e.local" \
    -keyout "$TLS_DIR/ecommerce.key" -out "$TLS_DIR/ecommerce.crt" 2>/dev/null
fi
chmod 600 "$TLS_DIR/ecommerce.key"

log "Configurando NGINX"
install -m 0644 "$DEPLOY_DIR/edge/nginx/ecommerce-global.conf" /etc/nginx/conf.d/ecommerce-global.conf
install -m 0644 "$DEPLOY_DIR/edge/nginx/ecommerce-proxy.conf" /etc/nginx/snippets/ecommerce-proxy.conf
install -m 0644 "$DEPLOY_DIR/edge/nginx/ecommerce-headers.conf" /etc/nginx/snippets/ecommerce-headers.conf
render_template "$DEPLOY_DIR/edge/nginx/ecommerce.conf.tpl" /etc/nginx/sites-available/ecommerce
ln -sf /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/ecommerce
rm -f /etc/nginx/sites-enabled/default

install -d -o www-data -g www-data -m 0750 /var/cache/nginx/images
# La SPA la compila app1 al instalarse.
install -d -m 0755 "$WEB_ROOT"
if [[ -f "$REPO_DIR/.release/spa/index.html" ]]; then
  rsync -a --delete "$REPO_DIR/.release/spa/" "$WEB_ROOT/"
  chmod -R a+rX "$WEB_ROOT"
elif [[ ! -f "$WEB_ROOT/index.html" ]]; then
  cat >"$WEB_ROOT/index.html" <<'EOF'
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Sistema E</title></head>
<body>
<h1>Sistema E</h1>
<p>La interfaz se publica con deploy/release.sh.</p>
<p><a href="/api/docs/">Documentación de la API</a></p>
</body>
</html>
EOF
fi

nginx -t
systemd_restart_always nginx.service
systemctl enable nginx >/dev/null
systemctl restart nginx

log "Firewall"
firewall_base
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
firewall_enable

log "Estado: /api/v1/health a través de NGINX"
for _ in 1 2 3 4; do
  curl -sk "https://$EDGE_IP/api/v1/health" || true
  echo
done
log "NGINX listo en edge"
