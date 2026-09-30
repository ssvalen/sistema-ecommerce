#!/usr/bin/env bash
# Uso (anfitrión): vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/seed-demo.sh"

source "${REPO_DIR:-/vagrant}/deploy/common/lib.sh"
require_root

load_env_file /etc/ecommerce/ecommerce.env

cd /opt/ecommerce/src/backend
pnpm exec tsx scripts/seed-demo.ts
