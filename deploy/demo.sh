#!/usr/bin/env bash
# Demostración de balanceo, fallos y failover.
# Uso (anfitrión, Git Bash): bash deploy/demo.sh 1-9 | all | watch
#   watch: tráfico continuo a /health; sirve para correr release.sh o failover.sh en paralelo.

source "$(dirname "${BASH_SOURCE[0]}")/common/host.sh"

BASE_URL="${DEMO_BASE_URL:-https://$(cluster_get EDGE_IP)}"
API="$BASE_URL/api/v1"
UNIT=ecommerce-api@3000

WORK="$(mktemp -d)"
if command -v cygpath >/dev/null; then WORK="$(cygpath -m "$WORK")"; fi
trap 'rm -rf "$WORK"' EXIT
ADMIN_JAR="$WORK/admin.jar"
CUSTOMER_JAR="$WORK/customer.jar"
CUSTOMER_READY=false
ADMIN_READY=false

pause() {
  if [[ -t 0 ]]; then read -r -p "    [Enter para continuar] " _; fi
}

# request MÉTODO RUTA [JSON] [COOKIES]: deja la respuesta en CODE, TIME, BODY y HEADERS.
# Sin procesos extra: en Git Bash cada uno cuesta cientos de ms.
request() {
  local method="$1" path="$2" json="${3:-}" jar="${4:-}"
  local args=(-sk -X "$method" -D "$WORK/headers" -o "$WORK/body" --max-time 30
    -w '%{http_code} %{time_total}')
  if [[ -n "$jar" ]]; then args+=(-b "$jar" -c "$jar"); fi
  if [[ -n "$json" ]]; then args+=(-H 'Content-Type: application/json' --data "$json"); fi
  : >"$WORK/body"
  : >"$WORK/headers"
  curl "${args[@]}" "$API$path" >"$WORK/meta" 2>/dev/null || true
  CODE=000 TIME=0 BODY='' HEADERS=''
  read -r CODE TIME <"$WORK/meta" || true
  IFS= read -r -d '' BODY <"$WORK/body" || true
  IFS= read -r -d '' HEADERS <"$WORK/headers" || true
  BODY="${BODY//$'\r'/}"
  HEADERS="${HEADERS//$'\r'/}"
}

# Primer valor de "clave" en BODY (texto o número), en REPLY.
json_field() {
  local text="\"$1\":\"([^\"]*)\"" number="\"$1\":([0-9]+)"
  REPLY=''
  if [[ "$BODY" =~ $text || "$BODY" =~ $number ]]; then REPLY="${BASH_REMATCH[1]}"; fi
}

# Valor de un header de la respuesta, en REPLY. Con HTTP/2 los nombres llegan en minúsculas.
header_field() {
  local pattern="(^|"$'\n'")$1: ([^"$'\n'"]*)"
  REPLY=''
  shopt -s nocasematch
  if [[ "$HEADERS" =~ $pattern ]]; then REPLY="${BASH_REMATCH[2]}"; fi
  shopt -u nocasematch
}

json_str() {
  json_field "$1"
  printf '%s' "$REPLY"
}
json_num() { json_str "$1"; }
header() {
  header_field "$1"
  printf '%s' "$REPLY"
}

primary() { cluster_get CURRENT_PRIMARY; }
db() {
  local node="$1"
  shift
  on_vm "$node" db/db-node.sh "$@" | { grep -Eo '^[0-9]+$' || true; } | tail -n 1
}

health_line() {
  local instance
  request GET /health
  json_field instance
  instance="$REPLY"
  header_field X-Request-ID
  printf '    %(%T)T  HTTP %s  %-6s  %6ss  X-Request-ID %s\n' -1 "$CODE" "$instance" "$TIME" "$REPLY"
}

health_burst() {
  local i
  for ((i = 0; i < $1; i++)); do health_line; done
}

wait_both_instances() {
  local seen1=false seen2=false i
  info "Esperando a que api-1 y api-2 respondan..."
  for ((i = 0; i < ${1:-40}; i++)); do
    request GET /health
    if [[ "$CODE" == 200 ]]; then
      json_field instance
      [[ "$REPLY" == api-1 ]] && seen1=true
      [[ "$REPLY" == api-2 ]] && seen2=true
    fi
    if $seen1 && $seen2; then
      info "Las dos instancias responden."
      return 0
    fi
    sleep 1
  done
  die "Las dos instancias no volvieron a responder"
}

wait_replicated() {
  local node="$1" table="$2" id="$3" i
  for ((i = 0; i < 10; i++)); do
    if [[ "$(db "$node" exists "$table" "$id")" == 1 ]]; then
      info "La fila $table #$id ya está en $node (consulta de solo lectura en la réplica)."
      return 0
    fi
    sleep 1
  done
  die "La fila $table #$id no llegó a $node"
}

replica_available() {
  local node
  node="$(peer_of "$(primary)")"
  vm_running "$node" && on_vm "$node" db/db-node.sh require-replica >/dev/null 2>&1
}

ensure_customer() {
  $CUSTOMER_READY && return 0
  local email password
  email="demo-$(date +%s)-$RANDOM@sistema-e.local"
  password="$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  request POST /auth/register "{\"name\":\"Cliente demo\",\"email\":\"$email\",\"password\":\"$password\"}"
  [[ "$CODE" == 201 ]] || die "No se pudo registrar el cliente de demo (HTTP $CODE): $BODY"
  request POST /auth/login "{\"email\":\"$email\",\"password\":\"$password\"}" "$CUSTOMER_JAR"
  [[ "$CODE" == 200 ]] || die "No se pudo iniciar sesión como cliente (HTTP $CODE): $BODY"
  CUSTOMER_READY=true
  info "Cliente de demo: $email"
}

ensure_admin() {
  $ADMIN_READY && return 0
  local email password
  email="$(env_get "$SECRETS_ENV" ADMIN_EMAIL)"
  password="$(env_get "$SECRETS_ENV" ADMIN_PASSWORD)"
  [[ -n "$email" && -n "$password" ]] || die "Faltan ADMIN_EMAIL o ADMIN_PASSWORD en $SECRETS_ENV"
  request POST /auth/login "{\"email\":\"$email\",\"password\":\"$password\"}" "$ADMIN_JAR"
  [[ "$CODE" == 200 ]] || die "No se pudo iniciar sesión como administrador (HTTP $CODE): $BODY"
  ADMIN_READY=true
}

# Pedido pendiente de un producto con stock: deja PRODUCT_ID y ORDER_ID.
create_pending_order() {
  ensure_customer
  PRODUCT_ID="$(db "$(primary)" pick-product)"
  [[ -n "$PRODUCT_ID" ]] ||
    die "No hay productos con stock. Carga datos: vagrant ssh app1 -c 'sudo bash /vagrant/deploy/app/seed-demo.sh'"
  request POST /cart/items "{\"productId\":$PRODUCT_ID,\"quantity\":1}" "$CUSTOMER_JAR"
  [[ "$CODE" == 200 ]] || die "No se pudo agregar al carrito (HTTP $CODE): $BODY"
  request POST /orders "" "$CUSTOMER_JAR"
  [[ "$CODE" == 201 ]] || die "No se pudo crear el pedido (HTTP $CODE): $BODY"
  ORDER_ID="$(json_num id)"
}

scenario_1() {
  step "1. Balanceo entre api-1 y api-2"
  info "GET /api/v1/health seis veces a través de NGINX:"
  health_burst 6
  local instance request_id
  instance="$(json_str instance)"
  request_id="$(header X-Request-ID)"
  [[ -n "$instance" && -n "$request_id" ]] || die "La última request no respondió (HTTP $CODE)"
  info "La última la atendió $instance. Su X-Request-ID en el journal de app${instance#api-}:"
  on_vm_raw "app${instance#api-}" "sudo journalctl -u $UNIT --since '-10 min' -o cat | grep -F $request_id | tail -n 1" |
    cut -c1-200 | sed 's/^/    /'
}

scenario_2() {
  step "2. Instancia detenida"
  info "systemctl stop $UNIT en app1. Todo lo atiende api-2, sin errores:"
  on_vm_raw app1 "sudo systemctl stop $UNIT"
  health_burst 6
  on_vm_raw app1 "sudo systemctl start $UNIT"
  wait_both_instances
}

scenario_3() {
  step "3. Reinicio automático"
  info "Proceso de la API en app1:"
  on_vm_raw app1 "systemctl show -p MainPID -p NRestarts $UNIT" | sed 's/^/    /'
  info "kill -9 (SIGKILL) al proceso de la API en app1:"
  on_vm_raw app1 "sudo systemctl kill --kill-whom=main --signal=SIGKILL $UNIT"
  health_burst 4
  sleep 3
  info "systemd la reinició (MainPID nuevo, NRestarts + 1):"
  on_vm_raw app1 "systemctl show -p MainPID -p NRestarts $UNIT" | sed 's/^/    /'
  wait_both_instances
}

scenario_4() {
  step "4. Caída de un host de aplicación"
  info "vagrant halt app1 --force. El sistema sigue desde api-2:"
  vagrant halt app1 --force
  health_burst 6
  info "Se enciende app1 (vagrant up app1); la API arranca sola con la VM."
  vagrant up app1
  wait_both_instances 90
}

scenario_5() {
  step "5. Instancia colgada"
  info "kill -STOP al proceso de la API en app1: sigue vivo, pero no responde."
  on_vm_raw app1 "sudo systemctl kill --kill-whom=main --signal=SIGSTOP $UNIT"
  info "Lo que va a app1 espera proxy_read_timeout (10 s) y NGINX lo reintenta en api-2:"
  health_burst 4
  info "Tras 2 fallas, NGINX saca a app1 del reparto por 10 s (fail_timeout):"
  health_burst 4
  on_vm_raw app1 "sudo systemctl kill --kill-whom=main --signal=SIGCONT $UNIT"
  info "kill -CONT: app1 vuelve."
  wait_both_instances
}

scenario_6() {
  step "6. Rollback de un pago rechazado"
  create_pending_order
  info "Pedido #$ORDER_ID creado (TX1). Stock del producto #$PRODUCT_ID en la base: $(db "$(primary)" stock "$PRODUCT_ID")"
  request POST "/orders/$ORDER_ID/payment" '{"simulatedResult":"DECLINED"}' "$CUSTOMER_JAR"
  info "Pago con simulatedResult DECLINED: HTTP $CODE $(json_str code)"
  request GET "/orders/$ORDER_ID" "" "$CUSTOMER_JAR"
  info "El pedido sigue en $(json_str status); stock: $(db "$(primary)" stock "$PRODUCT_ID") (sin cambios)"
  request POST "/orders/$ORDER_ID/payment" '{"simulatedResult":"APPROVED"}' "$CUSTOMER_JAR"
  info "Pago aprobado: HTTP $CODE, pedido $(json_str status); stock: $(db "$(primary)" stock "$PRODUCT_ID")"
}

scenario_7() {
  step "7. Redis caído"
  on_vm_raw data2 "sudo systemctl stop redis-server"
  info "Redis detenido en data2. El catálogo responde desde PostgreSQL:"
  request GET "/products?pageSize=3"
  info "GET /products: HTTP $CODE, X-Cache: $(header X-Cache)"
  request GET /health
  info "Health: $(json_str status) (caché $(json_str cache))"
  on_vm_raw data2 "sudo systemctl start redis-server"
  info "Redis de nuevo arriba:"
  local i
  for ((i = 0; i < 10; i++)); do
    request GET "/products?pageSize=3"
    header_field X-Cache
    [[ "$REPLY" != BYPASS ]] && break
    sleep 1
  done
  info "GET /products: X-Cache $(header X-Cache)"
  request GET "/products?pageSize=3"
  info "GET /products: X-Cache $(header X-Cache)"
}

scenario_8() {
  step "8. Replicación"
  local primary_node replica product_id category_id
  primary_node="$(primary)"
  replica="$(peer_of "$primary_node")"
  if ! replica_available; then
    info "No hay réplica activa en $replica. Reconstrúyela con: bash deploy/rebuild-standby.sh $replica"
    return 0
  fi
  ensure_admin
  request GET /categories
  category_id="$(json_num id)"
  [[ -n "$category_id" ]] || die "No hay categorías: crea una desde el admin"
  request POST /products \
    "{\"categoryId\":$category_id,\"name\":\"Demo de replicacion $(date +%H%M%S)\",\"price\":\"10.00\",\"stock\":1}" \
    "$ADMIN_JAR"
  [[ "$CODE" == 201 ]] || die "No se pudo crear el producto (HTTP $CODE): $BODY"
  product_id="$(json_num id)"
  info "Producto #$product_id creado en el primario ($primary_node)."
  wait_replicated "$replica" products "$product_id"
  info "Estado en el primario:"
  on_vm "$primary_node" db/db-node.sh status | sed 's/^/    /'
  request DELETE "/products/$product_id" "" "$ADMIN_JAR"
  info "Producto de demo eliminado (HTTP $CODE)."
}

scenario_9() {
  step "9. Failover del primario"
  local old new
  old="$(primary)"
  new="$(peer_of "$old")"
  if ! replica_available; then
    info "No hay réplica activa en $new. Reconstrúyela con: bash deploy/rebuild-standby.sh $new"
    return 0
  fi
  info "Este escenario apaga $old, promueve $new y reconstruye $old como réplica."
  pause
  create_pending_order
  info "Pedido #$ORDER_ID creado. Se espera a que llegue a $new (la replicación es asíncrona):"
  wait_replicated "$new" orders "$ORDER_ID"

  step "9.2 vagrant halt $old --force: sin base de datos, la API responde 503"
  vagrant halt "$old" --force
  health_burst 2

  step "9.3 failover.sh"
  bash deploy/failover.sh --yes
  health_burst 2
  request GET "/orders/$ORDER_ID" "" "$CUSTOMER_JAR"
  info "El pedido #$ORDER_ID sigue ahí: HTTP $CODE, $(json_str status)"

  step "9.4 $old vuelve como réplica"
  vagrant up "$old"
  bash deploy/rebuild-standby.sh "$old" --yes
  info "cluster.env queda con CURRENT_PRIMARY=$new. Para volver a $old: bash deploy/failover.sh"
  info "y después bash deploy/rebuild-standby.sh $new."
}

watch_traffic() {
  local total=0 errors=0
  step "Tráfico continuo a $API/health (Ctrl+C para terminar)"
  trap 'printf "\n    %s requests, %s sin 200\n" "$total" "$errors"; exit 0' INT
  while :; do
    request GET /health
    total=$((total + 1))
    [[ "$CODE" == 200 ]] || errors=$((errors + 1))
    json_field instance
    printf '    %(%T)T  HTTP %s  %-6s  %6ss\n' -1 "$CODE" "$REPLY" "$TIME"
    sleep 0.5
  done
}

case "${1:-}" in
  [1-9]) "scenario_$1" ;;
  all)
    for n in 1 2 3 4 5 6 7 8 9; do
      "scenario_$n"
      [[ "$n" == 9 ]] || pause
    done
    ;;
  watch) watch_traffic ;;
  *) die "Uso: bash deploy/demo.sh 1-9 | all | watch" ;;
esac
