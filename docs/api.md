# API REST

sistema-e es una tienda en línea con dos tipos de usuario: **cliente** y **administrador**. Su backend es una API REST en Node.js y TypeScript. En la instalación en VMs corre en dos instancias idénticas detrás de NGINX, que es el único punto de entrada.

Este documento describe el contrato de esa API: endpoints, autenticación, formato de las respuestas, códigos HTTP y códigos de error.

| Entorno | URL base |
|---|---|
| Instalación en VMs | `https://192.168.56.10/api/v1` |
| Desarrollo local | `http://127.0.0.1:3000/api/v1` |

Todas las requests y respuestas son JSON, salvo la subida y la descarga de imágenes. Los mensajes de la API están en español.

## 1. Swagger / OpenAPI

| Recurso | Ruta |
|---|---|
| Swagger UI | `/api/docs` |
| Especificación OpenAPI 3 | `/api/docs/openapi.json` |

La especificación se genera con zod-to-openapi a partir de los mismos esquemas Zod (`packages/contracts`) que validan las requests. Por eso la documentación no puede desalinearse de la validación. Cada operación documenta sus parámetros, ejemplos y errores posibles.

Para probar endpoints protegidos desde Swagger UI:

1. Ejecutar `POST /auth/login` con las credenciales de un usuario.
2. El navegador guarda la cookie de sesión y la envía sola en las requests siguientes.

## 2. Autenticación y autorización

- **Sesión:** `POST /auth/login` emite un JWT (HS256, `{ sub: userId }`) en la cookie `access_token`.
  - La cookie es `HttpOnly`, `Secure`, `SameSite=Strict` y `Path=/api`.
  - Su `Max-Age` coincide con la expiración del token (`JWT_EXPIRES_IN`, 2 horas por defecto).
  - JavaScript no puede leerla.
- **En cada request protegida** la API verifica el JWT **y** consulta el usuario en la base de datos. El rol y el estado salen de la base, no del token. Por eso el bloqueo de una cuenta tiene efecto inmediato.
- **Roles:**
  - El carrito, los pedidos propios y las reseñas propias son solo para `CUSTOMER`.
  - La gestión (productos, categorías, inventario, usuarios y moderación de reseñas) es solo para `ADMIN`.
- **Registro:** solo crea cuentas `CUSTOMER`. No hay endpoint para crear administradores: el administrador inicial se crea durante la instalación con el script `create-admin`.
- **Login fallido:** responde con un mensaje genérico que no revela si el email existe. Una cuenta bloqueada con la contraseña correcta recibe 403 `ACCOUNT_BLOCKED`.

## 3. Endpoints

Las 37 operaciones de la API:

| Recurso | Método y ruta | Acceso | Descripción |
|---|---|---|---|
| **Auth** | `POST /auth/register` | Público | Crea una cuenta `CUSTOMER` (201) |
| | `POST /auth/login` | Público | Inicia sesión y emite la cookie |
| | `POST /auth/logout` | Público | Borra la cookie de sesión (204) |
| | `GET /auth/me` | Sesión | Usuario de la sesión actual |
| **Categorías** | `GET /categories` | Público | Lista de categorías |
| | `GET /categories/{id}` | Público | Detalle |
| | `POST /categories` | Admin | Crea (201) |
| | `PATCH /categories/{id}` | Admin | Edita |
| | `DELETE /categories/{id}` | Admin | Elimina (204). 409 si tiene productos, incluso eliminados |
| **Productos** | `GET /products` | Público | Catálogo paginado con búsqueda, filtros y orden (§5) |
| | `GET /products/{id}` | Público | Detalle con el stock real |
| | `POST /products` | Admin | Crea (201), con stock inicial e imagen opcional por URL |
| | `PATCH /products/{id}` | Admin | Edita los datos descriptivos; `imageUrl: null` quita la imagen. No modifica el stock |
| | `DELETE /products/{id}` | Admin | Borrado lógico (204); también lo quita de los carritos |
| | `PUT /products/{id}/image` | Admin | Sube la imagen (multipart, campo `image`; JPEG, PNG o WebP; máximo 2 MB) |
| **Imágenes** | `GET /images/{id}` | Público | Sirve una imagen subida, con caché inmutable |
| **Reseñas** | `GET /products/{id}/reviews` | Público | Reseñas del producto, paginadas, las más recientes primero |
| | `GET /products/{id}/reviews/me` | Cliente | Si el cliente puede reseñar el producto y su reseña, si existe |
| | `PUT /products/{id}/reviews/me` | Cliente | Crea (201) o reemplaza (200) la reseña propia. Solo si compró el producto |
| | `DELETE /products/{id}/reviews/me` | Cliente | Elimina la reseña propia (204) |
| | `DELETE /reviews/{id}` | Admin | Elimina cualquier reseña (204) |
| **Inventario** | `GET /inventory` | Admin | Stock y unidades vendidas de cada producto, paginado |
| | `PATCH /inventory/{productId}` | Admin | Ajuste atómico `{ "adjustment": ±n }`. 409 si el stock quedaría negativo |
| **Carrito** | `GET /cart` | Cliente | Ítems con precio actual, cantidad, subtotal y disponibilidad, más el total |
| | `POST /cart/items` | Cliente | Agrega un producto; si ya estaba, suma la cantidad |
| | `PATCH /cart/items/{productId}` | Cliente | Fija la cantidad de un ítem |
| | `DELETE /cart/items/{productId}` | Cliente | Quita el ítem (204) |
| **Pedidos** | `POST /orders` | Cliente | Crea el pedido a partir del carrito (201, estado `PENDING_PAYMENT`) |
| | `GET /orders` | Cliente | Historial propio, paginado |
| | `GET /orders/{id}` | Cliente | Detalle. 404 si el pedido es de otro cliente |
| | `POST /orders/{id}/payment` | Cliente | Pago simulado: el pedido pasa a `COMPLETED` y se descuenta el inventario |
| **Usuarios** | `GET /users` | Admin | Listado paginado |
| | `GET /users/{id}` | Admin | Detalle |
| | `PATCH /users/{id}/status` | Admin | `{ "status": "ACTIVE" \| "BLOCKED" }`. Un administrador no puede bloquearse a sí mismo |
| | `GET /users/{id}/orders` | Admin | Historial de pedidos de un cliente, paginado |
| | `GET /users/{id}/orders/{orderId}` | Admin | Detalle de un pedido de ese cliente |
| **Salud** | `GET /health` | Público | Instancia que respondió y estado de sus dependencias (§4) |

**Paginación:** todos los listados paginados aceptan `page` (≥ 1, por defecto 1) y `pageSize` (de 1 a 100, por defecto 20).

## 4. Salud

```json
{ "data": { "status": "ok", "instance": "api-1", "checks": { "database": "up", "cache": "up" } } }
```

| `status` | Significado | HTTP |
|---|---|---|
| `ok` | Base de datos y caché disponibles | 200 |
| `degraded` | Sin caché: la instancia funciona leyendo de PostgreSQL | 200 |
| `unavailable` | Sin base de datos | 503 |

- **`instance`:** identifica qué instancia atendió la request (`api-1` o `api-2`). Sirve para demostrar el balanceo.
- **Límite de tiempo:** cada verificación tiene un límite de 1 s.
- **Uso en los scripts:** los de despliegue y failover usan este endpoint para saber cuándo una instancia está lista.

## 5. Catálogo

`GET /products?q&categoryId&minPrice&maxPrice&sort&page&pageSize`

| Parámetro | Descripción |
|---|---|
| `q` | Búsqueda en el nombre y la descripción, sin distinguir mayúsculas |
| `categoryId` | Filtra por categoría |
| `minPrice`, `maxPrice` | Rango de precio. `minPrice > maxPrice` responde 400 |
| `sort` | Por defecto, los más recientes primero. `popularity` ordena por unidades vendidas |
| `page`, `pageSize` | Paginación (§3) |

- **Producto:** cada uno incluye `stock`, `unitsSold` y `rating`.
  - `rating` es `{ average, count }`: el promedio de las reseñas con un decimal (`null` si no hay) y su cantidad.
- **Montos:** salen como texto con dos decimales (`"199.90"`). Se reciben como número o texto, mayores que 0, con hasta 10 enteros y 2 decimales.
- **Caché:** `GET /products` y `GET /categories` se sirven desde una caché en Redis y responden con el header `X-Cache`:

  | Valor | Significado |
  |---|---|
  | `HIT` | La respuesta salió de la caché |
  | `MISS` | Se leyó de PostgreSQL y se guardó en la caché |
  | `BYPASS` | Redis no respondió; se leyó directamente de PostgreSQL |

- **Atraso del listado:** un cambio del administrador se refleja de inmediato. En cambio, las compras y las reseñas no renuevan la caché, así que el stock, la popularidad y la calificación del listado pueden tener hasta 60 s de atraso. El detalle del producto, el carrito y el pago siempre usan el valor real.

## 6. Imagen de producto

- **Dos opciones excluyentes:**
  - una URL externa (solo `https`), en el campo `imageUrl` de `POST` o `PATCH /products`;
  - un archivo subido con `PUT /products/{id}/image`.

  Asignar una elimina la otra.
- **Cómo la ven los clientes:** los DTOs de producto exponen un único `imageUrl`, que puede ser:
  - `/api/v1/images/{id}` si la imagen es subida;
  - la URL externa;
  - `null` si no hay imagen.
- **Validación de la subida:**
  - El tipo se detecta por el contenido del archivo (magic bytes), no por su nombre ni por su extensión.
  - No se aceptan SVG.
  - El nombre original nunca se usa.
- **Servido:** `GET /images/{id}` responde con:
  - el `Content-Type` guardado;
  - `X-Content-Type-Options: nosniff`;
  - `Cache-Control: public, max-age=31536000, immutable`.

  Cada imagen nueva recibe un `id` nuevo, así que una URL nunca cambia de contenido.

## 7. Pedidos y pago simulado

La compra tiene dos pasos:

1. **`POST /orders`** convierte el carrito en un pedido `PENDING_PAYMENT`.
   - Congela el precio de cada ítem.
   - Vacía del carrito los productos que entraron al pedido.
   - Todavía no toca el inventario.
2. **`POST /orders/{id}/payment`** ejecuta el pago simulado.
   - Si se aprueba, el pedido pasa a `COMPLETED` y se descuenta el stock, todo en una sola transacción.
   - El pago cobra el `total` guardado en el pedido, no uno recalculado con los precios actuales.

**El pago simulado:**

- Aprueba por defecto y genera una referencia `SIM-<uuid>`. El cuerpo es opcional.
- Con `{ "simulatedResult": "DECLINED" }` se fuerza un rechazo (402). Sirve para demostrar el rollback: el pedido queda `PENDING_PAYMENT`, el inventario intacto y el pago se puede reintentar.
- El pago simulado no recibe ni guarda datos de tarjeta.

## 8. Reseñas

- **Quién puede reseñar:** solo un cliente que tiene un pedido `COMPLETED` con ese producto. Si no lo tiene, recibe 403 `REVIEW_NOT_ALLOWED`. `GET /products/{id}/reviews/me` indica, con `canReview`, si puede hacerlo.
- **Una reseña por cliente y producto:** un segundo `PUT` reemplaza la anterior.
- **Contenido:**
  - `rating` es un entero de 1 a 5;
  - `comment` es opcional, de hasta 1.000 caracteres. Un comentario vacío equivale a `null`.
- **Autor:** se publica como nombre e inicial del apellido (`"Ana L."`), nunca con el email.
- **Productos eliminados:** sus reseñas ya no se pueden consultar (404).

## 9. Formato de respuesta

Éxito:

```json
{ "data": { "id": 12, "name": "Camisa azul", "imageUrl": "/api/v1/images/7" } }
```

Listado paginado:

```json
{ "data": [ ], "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
```

Error (siempre con la misma forma; `details` es opcional):

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "No hay stock suficiente para algunos productos.",
    "details": [ { "productId": 12, "name": "Camisa azul", "requested": 3, "available": 1 } ]
  }
}
```

- **Validación de entrada:** los objetos de entrada son estrictos: un campo desconocido responde 400.
- **`X-Request-ID`:** cada respuesta lo incluye. Es el mismo identificador que aparece en los logs de la instancia que atendió la request.

## 10. Códigos HTTP

| Código | Cuándo |
|---|---|
| 200 | Lectura o actualización |
| 201 | Creación |
| 204 | Eliminación o logout |
| 400 | Error de validación (`details` lista cada problema), JSON inválido o subida mal formada |
| 401 | Sin sesión, o token inválido o expirado |
| 402 | Pago simulado rechazado |
| 403 | Rol no permitido, cuenta bloqueada o reseña no permitida |
| 404 | No existe, o pertenece a otro cliente (no se revela que existe) |
| 409 | Conflicto de negocio o de integridad (ver §11) |
| 413 | Cuerpo de la request o imagen demasiado grande |
| 415 | Imagen de un tipo no admitido, o codificación del cuerpo no admitida |
| 503 | Base de datos no disponible o una espera de lock que excedió su límite |
| 500 | Error interno. Mensaje genérico, nunca stack traces |

## 11. Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body, query o params inválidos |
| `INVALID_JSON` | 400 | El cuerpo no es JSON válido |
| `CATEGORY_NOT_FOUND` | 400 | Producto con una categoría inexistente |
| `IMAGE_REQUIRED` | 400 | Subida sin archivo en el campo `image` |
| `INVALID_UPLOAD` | 400 | Más de un archivo o un campo inesperado en la subida |
| `UNAUTHORIZED` | 401 | Request sin cookie de sesión |
| `INVALID_CREDENTIALS` | 401 | Email o contraseña incorrectos |
| `SESSION_INVALID` | 401 | Token inválido o expirado, o usuario inexistente; además se borra la cookie |
| `PAYMENT_DECLINED` | 402 | Pago simulado rechazado |
| `ACCOUNT_BLOCKED` | 403 | La cuenta está bloqueada (en el login o en cualquier request protegida) |
| `FORBIDDEN` | 403 | El rol no tiene permiso |
| `REVIEW_NOT_ALLOWED` | 403 | Reseñar un producto que el cliente no compró |
| `NOT_FOUND` | 404 | Recurso inexistente o ajeno, o ruta inexistente |
| `EMAIL_TAKEN` | 409 | Registro con un email ya usado |
| `SELF_BLOCK_NOT_ALLOWED` | 409 | Un administrador intenta bloquear su propia cuenta |
| `CATEGORY_NAME_TAKEN` | 409 | Nombre de categoría repetido |
| `CATEGORY_IN_USE` | 409 | Borrar una categoría que tiene productos |
| `INSUFFICIENT_STOCK` | 409 | El stock no alcanza en el carrito, en el pedido o en el pago, o un ajuste dejaría el stock negativo. `details` trae lo pedido y lo disponible |
| `CART_EMPTY` | 409 | Crear un pedido con el carrito vacío |
| `PRODUCT_UNAVAILABLE` | 409 | Un producto del carrito o del pedido fue eliminado |
| `ORDER_NOT_PENDING` | 409 | Pagar un pedido que ya está completado |
| `CONFLICT` | 409 | La base de datos rechazó la operación por una restricción (UNIQUE, FK o CHECK) |
| `PAYLOAD_TOO_LARGE` | 413 | Cuerpo de más de 100 KB o imagen de más de 2 MB |
| `UNSUPPORTED_IMAGE` | 415 | El archivo no es JPEG, PNG ni WebP según su contenido |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Codificación del cuerpo no admitida |
| `SERVICE_UNAVAILABLE` | 503 | Base de datos no disponible o timeout (ver abajo) |
| `INTERNAL_ERROR` | 500 | Error no previsto |

### Errores de la base de datos

El manejador de errores traduce los errores de Prisma y de PostgreSQL:

| Origen | Código | Respuesta |
|---|---|---|
| Violación de UNIQUE | Prisma `P2002` · SQLSTATE `23505` | 409 `CONFLICT` |
| Violación de FK | Prisma `P2003` · SQLSTATE `23503` | 409 `CONFLICT` |
| Violación de CHECK | SQLSTATE `23514` | 409 `CONFLICT` |
| Registro no encontrado | Prisma `P2025` | 404 `NOT_FOUND` |
| `lock_timeout`, `statement_timeout` o `idle_in_transaction_session_timeout` | SQLSTATE `55P03`, `57014`, `25P03` | 503 |
| Deadlock o conflicto de serialización | SQLSTATE `40P01`, `40001` · Prisma `P2034` | 503 |
| Demasiadas conexiones o servidor apagándose | SQLSTATE `53300`, `57P01` | 503 |
| Conexión fallida, rechazada o cerrada | SQLSTATE `08xxx` · Prisma `P1001`, `P1002`, `P1008`, `P1017` · errores de conexión del adaptador | 503 |
| Pool sin conexiones libres o timeout de la transacción | Prisma `P2024`, `P2028` | 503 |

Los errores 5xx se registran completos en el log, con su causa. Al cliente solo le llega el mensaje genérico.

## 12. Reintentos e idempotencia

- **NGINX** solo reintenta en la otra instancia una request que no llegó a ningún backend (conexión rechazada o timeout). Un `POST` o `PATCH` que una instancia ya recibió nunca se reenvía.
- **Repetir `POST /orders`** devuelve 409 `CART_EMPTY`: el primero ya vació el carrito.
- **Repetir `POST /orders/{id}/payment`** devuelve 409 `ORDER_NOT_PENDING`: el pedido ya está `COMPLETED`. Además, la base impide un segundo pago del mismo pedido (`payments.order_id` es UNIQUE).

Las operaciones críticas son idempotentes por su propio estado, así que no hacen falta claves de idempotencia.
