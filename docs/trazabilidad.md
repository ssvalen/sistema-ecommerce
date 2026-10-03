# Matriz de trazabilidad

sistema-e es una tienda en línea con dos tipos de usuario, cliente y administrador. Tiene:

- una API REST en Node.js, que corre en dos instancias detrás de NGINX;
- PostgreSQL, con primario y réplica;
- Redis como caché.

Esta matriz relaciona cada requisito de [requerimientos.md](requerimientos.md) con su implementación y con la forma de verificarlo.

**Métodos de verificación** (los pasos están en [guia-tecnica.md](guia-tecnica.md)):

| Método | Qué es |
|---|---|
| **Swagger** | Ejecutar el endpoint desde Swagger UI (`/api/docs`) y comprobar el código HTTP y la respuesta |
| **UI** | Recorrer la pantalla correspondiente en la interfaz web |
| **`verify-db.sh`** | Script que verifica estructura, constraints, permisos y timeouts de la base (guía §7) |
| **`demo.sh N`** | Escenario N de la demostración guiada (guía §8) |
| **`EXPLAIN ANALYZE`** | Plan de ejecución sobre los datos de demostración (guía §7) |
| **Revisión** | Inspección del código o de la configuración indicada |

## Usuarios y autenticación (§2)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| El cliente se registra | `POST /auth/register` (`identity/auth.service.ts`) | Swagger: 201; email repetido da 409 `EMAIL_TAKEN`; datos inválidos dan 400 · UI: `/register` |
| Iniciar sesión (cliente y administrador) | `POST /auth/login`: cookie `HttpOnly` con JWT HS256 | Swagger: login 200 · UI: `/login` |
| Cerrar sesión y consultar la sesión actual | `POST /auth/logout`, `GET /auth/me` | Swagger · UI: recargar la página mantiene la sesión |
| Hash seguro de contraseñas | argon2id (`identity/password.ts`) | Revisión: `users.password_hash` guarda un hash `$argon2id$…` |
| Una cuenta bloqueada no inicia sesión | `login` → 403 `ACCOUNT_BLOCKED` | Swagger: bloquear un cliente con `PATCH /users/{id}/status` e intentar el login |
| Una cuenta bloqueada no usa funciones protegidas, con efecto inmediato | `authenticate` consulta el usuario en cada request (`identity/auth.middleware.ts`) | Swagger: con la sesión del cliente abierta, bloquearlo desde una sesión de administrador; su siguiente request da 403 · UI: la sesión se cierra |
| Dos tipos de usuario | Enum `user_role` (`CUSTOMER`, `ADMIN`) · `authorize(role)` | Swagger: un cliente recibe 403 en los endpoints de administración; sin sesión, 401 |

## Productos (§3)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Nombre, descripción, precio, imagen, categoría, stock y unidades vendidas | Tablas `products` y `product_images` | `verify-db.sh` · Revisión: [base-de-datos.md](base-de-datos.md) |
| El administrador crea, edita y elimina | `POST`, `PATCH` y `DELETE /products` (borrado lógico) | Swagger · UI: `/admin/products` |
| Consultar el catálogo | `GET /products`, `GET /products/{id}` | Swagger · UI: `/` y `/products/:id` |
| Buscar | `q` → `ILIKE` con índice GIN de trigramas | UI: buscador · `EXPLAIN ANALYZE`: usa `products_name_trgm_idx` |
| Filtrar por categoría y por precio | `categoryId`, `minPrice`, `maxPrice` | Swagger: `minPrice > maxPrice` da 400 · UI: filtros del catálogo |
| Ordenar por popularidad (unidades vendidas) | `sort=popularity` → `units_sold DESC`, con índice | UI: «Más vendidos» con los datos de demostración · `EXPLAIN ANALYZE` |
| Paginación | `page` y `pageSize` (máximo 100), con `meta.total` | Swagger: `pageSize=500` da 400 · UI: paginación numerada |
| Imagen por URL o por archivo | URL `https`, o subida de JPEG, PNG o WebP de hasta 2 MB (`PUT /products/{id}/image`), validada por su contenido | Swagger: un SVG o un archivo renombrado da 415 · UI: editor de producto |
| Gestionar categorías | CRUD `/categories`; no se borra una categoría con productos (409) | Swagger · UI: `/admin/categories` |

## Carrito (§4)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Agregar, modificar, eliminar y consultar | `POST /cart/items`, `PATCH` y `DELETE /cart/items/{productId}`, `GET /cart` | Swagger · UI: `/cart` |
| Mostrar cantidades, subtotales y total | `GET /cart` calcula con `Decimal` en el servidor | Swagger · UI: `/cart` |
| Validar la cantidad contra el inventario | UPSERT + verificación en la misma transacción → 409 `INSUFFICIENT_STOCK` | Swagger: pedir más que el stock da 409 · UI: aviso de stock insuficiente |

## Pedidos y pago (§5)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Revisar el carrito y validar la disponibilidad | `POST /orders` bloquea el carrito y valida stock y productos activos | Swagger: carrito vacío da 409 `CART_EMPTY` |
| Crear el pedido y su detalle | `orders` + `order_items`, con el precio congelado | Swagger · UI: «Continuar al pago» |
| Pago simulado | `POST /orders/{id}/payment`, con `simulatedResult` opcional (`ordering/payment-simulator.ts`) | Swagger · UI: «Pagar» y «Simular pago rechazado» · `demo.sh 6` |
| Completar el pedido y descontar el inventario | Una transacción: pago, descuento de stock, `units_sold` y `COMPLETED` | `demo.sh 6`: el stock baja solo con el pago aprobado |
| Consultar el historial | `GET /orders`, `GET /orders/{id}` (un pedido ajeno da 404) | Swagger · UI: `/orders` |
| Transacciones con rollback ante una falla | `withTransaction`; un rechazo o la falta de stock revierte todo | `demo.sh 6`: con `DECLINED`, el pedido sigue pendiente y el stock intacto |

## Inventario (§6)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Stock por producto y disponibilidad | `products.stock` en los DTOs · `GET /inventory` | Swagger · UI: ficha del producto y `/admin/inventory` |
| Validar el stock antes de completar | En el pago: `FOR UPDATE` en orden de id y revalidación | Revisión: [arquitectura.md §8](arquitectura.md#8-flujos-críticos) |
| No vender más que el stock | Validación + `CHECK (stock >= 0)` | `verify-db.sh`: un stock negativo viola el CHECK |
| Descontar al completar el pedido | `inventory.recordSale`, dentro de la transacción del pago | `demo.sh 6` |
| El administrador ajusta el stock | `PATCH /inventory/{productId}` (delta atómico) | Swagger: un ajuste que deja el stock negativo da 409 · UI: `/admin/inventory` |

## Gestión de usuarios (§7)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Listar y consultar usuarios | `GET /users`, `GET /users/{id}` (solo administrador) | Swagger: un cliente recibe 403 · UI: `/admin/users` |
| Historial de pedidos de un cliente | `GET /users/{id}/orders`, `GET /users/{id}/orders/{orderId}` | Swagger · UI: `/admin/users/:id` |
| Bloquear y desbloquear | `PATCH /users/{id}/status`; un administrador no puede bloquearse a sí mismo (409) | Swagger · UI: `/admin/users/:id` |
| Restricciones según el estado de la cuenta | Ver «Usuarios y autenticación» | Igual que arriba |

## Reseñas (§8)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Reseñar un producto comprado (1 a 5 estrellas, comentario opcional) | `PUT /products/{id}/reviews/me`; sin compra completada, 403 `REVIEW_NOT_ALLOWED` | Swagger · UI: ficha del producto |
| Una reseña por cliente y producto, reemplazable y eliminable | `UNIQUE (user_id, product_id)` + `INSERT … ON CONFLICT` · `DELETE /products/{id}/reviews/me` | Swagger: un segundo `PUT` responde 200 y reemplaza |
| Calificación promedio y reseñas visibles | `rating` en el DTO de producto · `GET /products/{id}/reviews` | Swagger · UI: catálogo y ficha del producto |
| El administrador elimina reseñas | `DELETE /reviews/{id}` | Swagger · UI: ficha del producto con sesión de administrador |

## Base de datos (§9)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| PK, FK, constraints e integridad referencial | `schema.prisma` + 20 CHECK en las migraciones | `verify-db.sh` |
| Índices en las consultas frecuentes | Categoría, precio, popularidad, trigramas, historial, reseñas y FKs | `EXPLAIN ANALYZE` |
| Estados consistentes | Enums + `CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))` | `verify-db.sh` |
| Transacciones en las operaciones críticas | Carrito, creación de pedido, pago, borrado de productos, imágenes | `demo.sh 6` · Revisión: [base-de-datos.md §7](base-de-datos.md#7-transacciones) |
| Triggers solo si aportan una ventaja clara | Ninguno: `updated_at` y `units_sold` los asigna el backend | Revisión: migraciones |
| Lógica de negocio en el backend | Services; `contracts` solo tiene forma y formato | Revisión |
| Datos de demostración con volumen | `seed-demo.ts` / `seed-demo.sh` | Guía §6 |

## API REST (§10)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Endpoints de autenticación, usuarios, productos, categorías, carrito, pedidos, inventario y reseñas | 37 operaciones en `/api/v1` | Swagger |
| Validación de entrada | Zod, con objetos estrictos y mensajes en español | Swagger: un campo desconocido o inválido da 400 con `details` |
| Autorización según el tipo de usuario | `authenticate` + `authorize('ADMIN' \| 'CUSTOMER')` | Swagger: 401 sin sesión, 403 con el rol equivocado |
| Errores, códigos HTTP y respuestas consistentes | `{ data }`, `{ data, meta }`, `{ error: { code, message, details } }` | Swagger · Revisión: [api.md](api.md) |
| Documentación Swagger/OpenAPI | `/api/docs` y `/api/docs/openapi.json`, generados desde los esquemas Zod | Abrir `/api/docs` |

## Seguridad (§11)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Hash, autenticación y autorización | argon2id; JWT en cookie `HttpOnly`/`Secure`/`SameSite=Strict`; roles | Ver las secciones anteriores |
| Validación de entradas | Zod en body, query y params | Swagger |
| Endpoints administrativos protegidos | `authorize('ADMIN')` | Swagger: un cliente recibe 403 |
| Credenciales y secretos | `secrets.env` fuera de git · `EnvironmentFile` 0640 · `migrate.env` 0600 · roles de base con mínimo privilegio | `verify-db.sh`: el rol de la API no puede hacer DDL · Revisión: [infraestructura.md §4](infraestructura.md#4-seguridad-entre-vms-y-secretos) |
| HTTPS | NGINX en `edge`, TLS 1.2/1.3, certificado firmado por una CA local, redirección de 80 a 443 | `curl -I http://192.168.56.10` da 301 a HTTPS · `curl --cacert .release/tls/sistema-e-ca.crt https://192.168.56.10/api/v1/health` |
| No exponer información sensible | DTOs sin `password_hash`, errores 500 genéricos, `server_tokens off`, reseñas sin email | Swagger: ninguna respuesta incluye `password_hash` |

## Interfaz web (§12)

Cada funcionalidad tiene su pantalla en la SPA. La validación de los formularios usa los mismos esquemas de `packages/contracts` que el backend.

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| Servida por NGINX, desde el mismo origen que la API | `/var/www/ecommerce` en `edge` | UI: https://192.168.56.10 |
| Seguridad en el navegador | CSP sin inline, sin source maps, `/assets/` inmutable | Revisión: `index.html` sin scripts ni estilos inline |
| Módulos por contexto de negocio | `frontend/src/modules/` con los mismos nombres que el backend | Revisión: [arquitectura.md §6](arquitectura.md#6-frontend) |

| Funcionalidad | Pantalla |
|---|---|
| Registro e inicio de sesión | `/register`, `/login` |
| Catálogo: búsqueda, filtros, popularidad y paginación | `/`: buscador, categorías, filtros de precio, orden «Más vendidos» y paginación, todo reflejado en la URL |
| Detalle de producto y reseñas | `/products/:id` |
| Carrito | `/cart`: cantidades, subtotales, total y aviso de stock insuficiente |
| Pedido en dos pasos | `/cart` → «Continuar al pago» → `/orders/:id` → «Pagar» (con «Simular pago rechazado») |
| Historial de pedidos | `/orders`, `/orders/:id` |
| Administración: productos e imagen | `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit` |
| Administración: categorías | `/admin/categories` |
| Administración: inventario | `/admin/inventory` |
| Administración: usuarios, bloqueo y pedidos de un cliente | `/admin/users`, `/admin/users/:id`, `/admin/users/:id/orders/:orderId` |

## Infraestructura (§13)

| Requisito | Implementación | Cómo se verifica |
|---|---|---|
| NGINX como punto de entrada y balanceador | `edge`, upstream round-robin | `demo.sh 1`: alterna `api-1` y `api-2` |
| Dos instancias del backend | `app1` y `app2`, `ecommerce-api@3000` | `demo.sh 1` |
| PostgreSQL y Redis | `data1` (primario), `data2` (réplica y Redis) | `db-node.sh status` · `/health` |
| Servicios con systemd y reinicio automático | `Restart=always` en la API; drop-ins en NGINX, PostgreSQL y Redis | `demo.sh 3`: tras `kill -9`, systemd reinicia la API |
| Sigue atendiendo si una instancia deja de responder | `proxy_next_upstream error timeout` | `demo.sh 2`, `4` y `5` |
| Réplica y failover | Replicación por streaming, `failover.sh`, `rebuild-standby.sh` | `demo.sh 8` y `9` |
| Despliegue repetible con scripts | `Vagrantfile`, scripts por rol, `release.sh` | `vagrant destroy -f` + `vagrant up` |
| Despliegue sin cortes | `release.sh` escalonado | `demo.sh watch` sin errores durante un `release.sh` |
| Caché solo donde aporta | Listado y categorías en Redis, con degradación a PostgreSQL | `demo.sh 7`: con Redis detenido, `X-Cache: BYPASS` |

## Documentación (§14)

| Requisito | Documento |
|---|---|
| Descripción general de la solución | [README](../README.md) · [arquitectura.md §1](arquitectura.md#1-descripción-general) |
| Arquitectura de software y su diagrama | [arquitectura.md](arquitectura.md) |
| Diagrama de infraestructura | [infraestructura.md §1](infraestructura.md#1-diagrama-de-infraestructura) · explicación en [infraestructura-explicada.md](infraestructura-explicada.md) |
| Modelo de base de datos | [base-de-datos.md](base-de-datos.md) |
| Instrucciones de instalación y ejecución | [guia-tecnica.md](guia-tecnica.md) |
| Configuración de NGINX, systemd, PostgreSQL y Redis | [infraestructura.md §5–§8](infraestructura.md#5-nginx-edge) |
| Documentación de la API con Swagger/OpenAPI | `/api/docs` · [api.md](api.md) |
