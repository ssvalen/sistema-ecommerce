-- Roles, base de datos, permisos y timeouts. Idempotente; se ejecuta como superusuario:
--   DB_OWNER_PASSWORD=... DB_APP_PASSWORD=... psql -v ON_ERROR_STOP=1 -d postgres -f roles.sql
-- replicator lo crea install-db.sh (solo existe en las VMs).

\set ON_ERROR_STOP on

\getenv owner_password DB_OWNER_PASSWORD
\getenv app_password DB_APP_PASSWORD
\if :{?owner_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'Falta la variable de entorno DB_OWNER_PASSWORD'; END $$;
\endif
\if :{?app_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'Falta la variable de entorno DB_APP_PASSWORD'; END $$;
\endif

-- Roles

SELECT 'CREATE ROLE ecommerce_owner LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecommerce_owner') \gexec

SELECT 'CREATE ROLE ecommerce_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecommerce_app') \gexec

ALTER ROLE ecommerce_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'owner_password';
ALTER ROLE ecommerce_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

ALTER ROLE ecommerce_app SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ecommerce_app SET lock_timeout = '5s';
ALTER ROLE ecommerce_app SET statement_timeout = '15s';

-- Base de datos

SELECT 'CREATE DATABASE ecommerce OWNER ecommerce_owner ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ecommerce') \gexec

REVOKE ALL ON DATABASE ecommerce FROM PUBLIC;
GRANT CONNECT ON DATABASE ecommerce TO ecommerce_app;

\connect ecommerce

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ecommerce_app;

-- Solo DML para la API, sobre lo existente y lo que creen las migraciones.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecommerce_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecommerce_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ecommerce_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ecommerce_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ecommerce_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ecommerce_app;
