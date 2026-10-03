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
CA_DIR="$TLS_DIR/ca"
SITE_DNS=sistema-e.local

log "Instalando NGINX"
apt_install nginx openssl rsync
enable_time_sync

log "Certificados TLS: CA local y certificado del sitio"
install -d -m 0750 "$TLS_DIR"
install -d -m 0700 "$CA_DIR"
# nameConstraints: la CA solo puede firmar para este sitio.
if [[ ! -f "$CA_DIR/ca.crt" ]]; then
  openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 \
    -subj "/CN=Sistema E - CA local" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "nameConstraints=critical,permitted;IP:$EDGE_IP/255.255.255.255,permitted;DNS:$SITE_DNS" \
    -keyout "$CA_DIR/ca.key" -out "$CA_DIR/ca.crt" 2>/dev/null
fi
chmod 600 "$CA_DIR/ca.key"

# Se reemite si falta, no lo firmó esta CA, no cubre EDGE_IP o vence en menos de 30 días.
site_cert_valid() {
  local crt="$TLS_DIR/ecommerce.crt"
  [[ -f "$crt" ]] &&
    openssl verify -CAfile "$CA_DIR/ca.crt" "$crt" >/dev/null 2>&1 &&
    openssl x509 -in "$crt" -noout -checkend $((30 * 86400)) >/dev/null &&
    [[ "$(openssl x509 -in "$crt" -noout -checkip "$EDGE_IP")" == *"does match"* ]]
}
if ! site_cert_valid; then
  ext="$(mktemp)"
  printf '%s\n' \
    'basicConstraints=critical,CA:FALSE' \
    'keyUsage=critical,digitalSignature,keyEncipherment' \
    'extendedKeyUsage=serverAuth' \
    "subjectAltName=IP:$EDGE_IP,DNS:$SITE_DNS" >"$ext"
  openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$SITE_DNS" \
    -keyout "$TLS_DIR/ecommerce.key" -out "$TLS_DIR/ecommerce.csr" 2>/dev/null
  openssl x509 -req -sha256 -days 397 -set_serial "0x$(openssl rand -hex 16)" \
    -in "$TLS_DIR/ecommerce.csr" -CA "$CA_DIR/ca.crt" -CAkey "$CA_DIR/ca.key" \
    -extfile "$ext" -out "$TLS_DIR/ecommerce.crt" 2>/dev/null
  rm -f "$ext" "$TLS_DIR/ecommerce.csr"
fi
chmod 600 "$TLS_DIR/ecommerce.key"

# Solo la parte pública, para importarla en el anfitrión.
install -d "$REPO_DIR/.release/tls"
cp "$CA_DIR/ca.crt" "$REPO_DIR/.release/tls/sistema-e-ca.crt"

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

log "TLS verificado contra la CA local"
curl -sS --cacert "$CA_DIR/ca.crt" -o /dev/null -w 'HTTP %{http_code}\n' "https://$EDGE_IP/api/v1/health"
echo "Importa .release/tls/sistema-e-ca.crt en el anfitrión (raíces de confianza)."
openssl x509 -in "$CA_DIR/ca.crt" -noout -fingerprint -sha256
log "NGINX listo en edge"
