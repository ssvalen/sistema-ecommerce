#!/bin/sh
# Solo en la primera inicialización del contenedor. Mismo roles.sql que las VMs.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -f /deploy-db/roles.sql

# prisma migrate dev necesita crear la base shadow.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -c "ALTER ROLE ecommerce_owner CREATEDB;"
