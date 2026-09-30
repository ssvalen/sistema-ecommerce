#!/usr/bin/env bash
# Publica la SPA que compila release.sh (.release/spa) en /var/www/ecommerce.
# Uso (root, en edge): publish-spa.sh

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

SRC="$REPO_DIR/.release/spa"
[[ -f "$SRC/index.html" ]] || die "No hay SPA compilada en .release/spa (ejecuta deploy/release.sh)"

rsync -a --delete "$SRC/" /var/www/ecommerce/
chmod -R a+rX /var/www/ecommerce
nginx -t
systemctl reload nginx
log "SPA publicada"
