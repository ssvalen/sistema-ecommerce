#!/usr/bin/env bash
# Redis (solo caché) en data2. Idempotente.
# Uso (root): install-cache.sh

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

load_config
require_vars DATA2_IP APP1_IP APP2_IP REDIS_ADMIN_PASSWORD REDIS_APP_PASSWORD

[[ "$(hostname -s)" == data2 ]] || die "install-cache.sh corre en data2 (este nodo es '$(hostname -s)')"

log "Instalando Redis"
apt_install redis-server
enable_time_sync
allow_nonlocal_bind

log "Configurando Redis"
REDIS_ADMIN_PASSWORD_SHA256="$(sha256_hex "$REDIS_ADMIN_PASSWORD")"
REDIS_APP_PASSWORD_SHA256="$(sha256_hex "$REDIS_APP_PASSWORD")"
export REDIS_ADMIN_PASSWORD_SHA256 REDIS_APP_PASSWORD_SHA256
render_template "$DEPLOY_DIR/cache/redis/users.acl.tpl" /etc/redis/users.acl
chown redis:redis /etc/redis/users.acl
chmod 640 /etc/redis/users.acl

cat >/etc/redis/ecommerce.conf <<EOF
# Generado por deploy/cache/install-cache.sh. Incluido al final de redis.conf.
bind $DATA2_IP 127.0.0.1
protected-mode yes
port 6379
aclfile /etc/redis/users.acl
save ""
appendonly no
maxmemory 256mb
maxmemory-policy allkeys-lru
supervised systemd
EOF
chown redis:redis /etc/redis/ecommerce.conf
chmod 640 /etc/redis/ecommerce.conf
grep -qxF 'include /etc/redis/ecommerce.conf' /etc/redis/redis.conf ||
  printf '\ninclude /etc/redis/ecommerce.conf\n' >>/etc/redis/redis.conf

systemd_restart_always redis-server.service
systemctl enable redis-server >/dev/null
systemctl restart redis-server

log "Firewall"
firewall_base
firewall_allow_from "$APP1_IP" 6379
firewall_allow_from "$APP2_IP" 6379
firewall_enable

log "Estado"
REDISCLI_AUTH="$REDIS_ADMIN_PASSWORD" redis-cli --no-auth-warning -h 127.0.0.1 ping
REDISCLI_AUTH="$REDIS_ADMIN_PASSWORD" redis-cli --no-auth-warning -h 127.0.0.1 acl list |
  sed -E 's/#[0-9a-f]{64}/#<sha256>/g'
log "Redis listo en data2"
