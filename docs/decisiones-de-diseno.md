# Decisiones de diseño

sistema-e es una tienda en línea, con catálogo, carrito, pedidos con pago simulado, reseñas y administración.

- **Software:** una SPA en React y una API REST en Node.js, que corre en dos instancias detrás de NGINX.
- **Datos:** PostgreSQL, con primario y réplica, y Redis como caché.
- **Despliegue:** cinco VMs Ubuntu: `edge`, `app1`, `app2`, `data1` y `data2`.

Este documento explica **por qué** el sistema es como es: qué se decidió, qué alternativas se descartaron y qué consecuencias tiene cada decisión. El *qué* y el *cómo* están en los demás documentos:

| Documento | Contenido |
|---|---|
| [requerimientos.md](requerimientos.md) | Los requisitos del sistema |
| [arquitectura.md](arquitectura.md) | Componentes, módulos y flujos |
| [base-de-datos.md](base-de-datos.md) | Esquema, constraints e índices |
| [api.md](api.md) | Endpoints y errores |
| [infraestructura-explicada.md](infraestructura-explicada.md) | Cómo funciona la infraestructura y por qué |
| [infraestructura.md](infraestructura.md) | VMs y configuración |
| [guia-tecnica.md](guia-tecnica.md) | Cómo levantarlo y demostrarlo |

## 1. Resumen

| Tema | Decisión |
|---|---|
| Objetivo de escala | Correcto a escala pequeña; la API escala horizontalmente sin cambiar código |
| Arquitectura | Monolito modular replicado: una sola aplicación en módulos por contexto de negocio, desplegada en N instancias idénticas |
| Repositorio | Monorepo con pnpm workspaces: `backend`, `frontend`, `packages/contracts` |
| Backend | Express 5 + TypeScript, en capas por módulo: routes → controller → service → repository |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4, en módulos por bounded context (DDD estratégico, sin la capa táctica) |
| Validación | Zod, con esquemas compartidos entre frontend y backend en `packages/contracts` |
| Documentación de la API | OpenAPI generado desde los mismos esquemas Zod + Swagger UI |
| Acceso a datos | Prisma ORM + Prisma Migrate. SQL parametrizado (`$queryRaw`) solo para locks y upserts atómicos. CHECK como SQL en las migraciones |
| Base de datos | PostgreSQL 16: primario y réplica asíncrona en espera, con failover manual |
| Roles de base de datos | `ecommerce_owner` (migraciones), `ecommerce_app` (API, solo DML), `replicator` (replicación) |
| Contraseñas | argon2id |
| Sesión | JWT HS256 en cookie `HttpOnly` + `Secure` + `SameSite=Strict`; el usuario se consulta en la base en cada request |
| Pedido y pago | Dos pasos: crear el pedido (`PENDING_PAYMENT`) y pagarlo (`COMPLETED`) |
| Concurrencia | Locks pesimistas `FOR UPDATE` en orden fijo, más timeouts de PostgreSQL en el rol de la aplicación |
| Popularidad | Columna `units_sold`, actualizada en la misma transacción que descuenta el stock |
| Eliminar producto | Borrado lógico (`deleted_at`) |
| Imagen | URL externa `https`, o archivo subido guardado en PostgreSQL y servido con caché HTTP inmutable |
| Reseñas | Solo de clientes que compraron el producto; una por cliente y producto; promedio calculado en cada consulta |
| Caché | Redis, solo para el listado de productos y las categorías. Invalidación por versión ante cambios del administrador; TTL de 60 s para el resto |
| Triggers | Ninguno |
| Infraestructura | 5 VMs Ubuntu Server 24.04 en VirtualBox, creadas con Vagrant y configuradas con scripts bash; servicios con systemd |
| Verificación | Manual, con Swagger UI, `verify-db.sh` y `demo.sh` |
| Idioma | Código, tablas y endpoints en inglés. Documentación, interfaz y mensajes de la API en español |

## 2. Objetivo de escala

- **Escala pequeña, pero correcta:** funciona sin errores con decenas de usuarios concurrentes y decenas de miles de productos.
- **Escala horizontal de la API:** agregar capacidad es sumar una instancia y una línea en el upstream de NGINX. Para eso las instancias no tienen estado (§3).
- **Capa de datos:** un primario y una réplica en espera, con failover manual.
  - Protege los datos ante la pérdida de la VM del primario y recupera el servicio en minutos.
  - El failover es manual: automatizarlo sin riesgo de que haya dos primarios a la vez requiere al menos tres nodos (§11).

## 3. Arquitectura general

| Opción | Veredicto |
|---|---|
| Microservicios, uno por contexto | ✗ La transacción entre pedido, detalle e inventario dejaría de ser un `ROLLBACK` y habría que reemplazarla por sagas con compensaciones. Además, habría que operar varios servicios |
| Monolito sin módulos | ✗ Nada impide que cualquier parte toque cualquier tabla |
| **Monolito modular con N instancias idénticas** | ✓ Una sola base, con transacciones ACID reales entre contextos. Se despliega como una unidad y escala replicando |

**Consecuencias:**

- **Instancias sin estado:** la sesión va en un JWT, y los datos, la caché y los locks, en servicios compartidos. Así cualquier instancia atiende cualquier request y no hacen falta sticky sessions.
- **Fronteras explícitas entre módulos:** un módulo solo usa las funciones públicas de otro, nunca su repositorio ni sus tablas, y cada columna tiene un único módulo que la escribe.
- **Mismo origen:** la SPA, la API y las imágenes salen del mismo dominio a través de NGINX. No hace falta CORS, y `SameSite=Strict` cubre CSRF.

## 4. Backend y acceso a datos

- **Capas por módulo** (routes → controller → service → repository):
  - El service concentra las reglas y decide los límites de cada transacción.
  - El repository es el único lugar que conoce Prisma y recibe el ejecutor (cliente normal o de transacción). Así el service puede componer operaciones de varios módulos dentro de una misma transacción.
- **Primero se autentica y después se valida:** a quien no tiene sesión no se le revela qué formato espera la API.
- **DTOs explícitos:** los tipos de Prisma nunca llegan a una respuesta. Así no se filtran campos como `password_hash` y se controla la serialización de los montos (texto con dos decimales, calculados con `Decimal`).
- **Contratos compartidos solo de forma:**
  - `packages/contracts` tiene esquemas Zod de entrada y salida y reglas de formato.
  - Las reglas de negocio (stock, totales, estados, permisos) solo existen en el backend. Así la lógica no se duplica entre capas.
- **Prisma:**
  - Da cliente tipado, migraciones versionadas y transacciones interactivas.
  - Lo que no puede expresar se escribe en SQL parametrizado (`$queryRaw` con tagged templates, nunca `$queryRawUnsafe`):
    - los `SELECT … FOR UPDATE`;
    - el `INSERT … ON CONFLICT` atómico de las reseñas;
    - la carga de datos de demostración.
  - Los CHECK y las extensiones se agregan como SQL en las migraciones.
- **`withTransaction` con `timeout` (10 s) mayor que el `lock_timeout` de PostgreSQL (5 s):** si fuera menor, Prisma abortaría la transacción antes de que PostgreSQL informe qué lock la bloqueó.
- **Llaves `INTEGER`, no `BIGINT`:** Prisma expone `BIGINT` como `bigint` de JavaScript, que `JSON.stringify` no serializa. 2.100 millones de filas por tabla sobran.
- **Llaves secuenciales, no UUID:**
  - Son compactas, tienen buena localidad en el índice y las genera la base, así que son únicas con cualquier cantidad de instancias.
  - Que se puedan enumerar se mitiga con el control de propiedad: un recurso ajeno responde 404.

## 5. Modelo de datos

| Decisión | Por qué | Costo aceptado |
|---|---|---|
| Imágenes subidas en PostgreSQL (`bytea`), no en disco | Se replican con los datos, se actualizan en la misma transacción que el producto (sin archivos huérfanos) y no requieren almacenamiento compartido entre VMs | Las imágenes pasan por la base y la API. Se mitiga con caché HTTP inmutable y la caché en disco de NGINX |
| Borrado lógico de productos | Un borrado físico rompería los pedidos y las reseñas históricos | Una categoría con productos eliminados tampoco se puede borrar |
| `units_sold` desnormalizada en `products` | Permite indexar la popularidad; se actualiza en la misma transacción que el stock, así que no puede divergir | Cada compra reescribe la fila y sus índices |
| Stock en `products`, no en una tabla aparte | Ordenar por popularidad no necesita join | El mismo de la fila anterior, irrelevante a esta escala |
| `orders.total` guardado | Es inmutable: los ítems no cambian después de crear el pedido | — |
| Sin tabla `carts` | El carrito es el conjunto de `cart_items` del cliente; una tabla `(id, user_id)` no aportaría nada | — |
| Carrito en PostgreSQL, no en Redis | Son datos de negocio con integridad referencial | — |
| Sin triggers | Ningún caso los justifica: `updated_at` y `units_sold` los asigna el backend en sus transacciones, y así toda la lógica queda en un solo lugar | — |
| Sin índices parciales | `schema.prisma` no puede declararlos, y excluir los productos eliminados ahorraría poco | Índices algo más grandes |
| Paginación offset + `COUNT(*)` | La interfaz muestra números de página y el total | Las páginas profundas cuestan más. Keyset sería más eficiente, pero no da el total ni permite saltar a una página |

## 6. Pedido, pago y concurrencia

### Pedido en dos pasos

Crear el pedido (TX1) y pagarlo (TX2) son operaciones separadas:

- El cliente revisa un pedido con precios congelados antes de pagar.
- Un pago rechazado deja el pedido pendiente y reintentable.
- **TX1 no reserva stock.** Valida la disponibilidad para dar un error temprano, pero el stock se descuenta recién al pagar. Por eso TX2 revalida.

### Estrategia de concurrencia

| Estrategia | Veredicto |
|---|---|
| **Pesimista: `SELECT … FOR UPDATE` en orden de id** | ✓ Valida todos los ítems antes de escribir y da mensajes precisos (cuánto se pidió y cuánto hay) |
| Update condicional (`UPDATE … WHERE stock >= q`) | Correcto y más corto, pero falla ítem por ítem y sin saber cuánto stock quedaba. Se usa solo en el ajuste de inventario, que es de un producto |
| `SERIALIZABLE` | Correcto, pero obliga a reintentar transacciones desde la aplicación |

**Detalles de la estrategia:**

- **Orden de los locks:** siempre se bloquea en orden de id, para que dos pagos concurrentes no se bloqueen mutuamente (deadlock).
- **Aislamiento:** `READ COMMITTED` más los locks de fila es suficiente.

### Timeouts en el rol de la aplicación

Si una instancia se congela entre `BEGIN` y `COMMIT`, conserva sus locks de fila. Sin timeouts, la instancia sana quedaría esperando indefinidamente: el fallo de una instancia se propagaría a la otra.

Por eso el rol `ecommerce_app` tiene tres timeouts. Sus valores están en [base-de-datos.md §8](base-de-datos.md#8-roles-de-base-de-datos):

- `idle_in_transaction_session_timeout` cierra la sesión congelada y libera sus locks;
- `lock_timeout` hace que quien espera falle rápido (503) en vez de colgarse;
- `statement_timeout` impide que una consulta monopolice la base.

Se definen en el rol (`ALTER ROLE … SET`) y no en la aplicación: se guardan en el catálogo, se replican y siguen vigentes después de un failover.

### Idempotencia por estado

No hay claves de idempotencia, porque el propio estado protege cada operación:

- **Repetir la creación del pedido** da 409, porque el carrito ya está vacío.
- **Repetir el pago** da 409, porque el pedido ya está completado. Además, `payments.order_id UNIQUE` impide un segundo cobro.
- **NGINX** nunca reenvía un `POST` que ya recibió una instancia.

### Límite consciente

El simulador de pago se ejecuta mientras se mantienen los locks de los productos. Es válido **porque el simulador es local e instantáneo**: los locks duran milisegundos. Un paso lento dentro de esa transacción haría esperar a todas las compras de los mismos productos.

### Replicación asíncrona

Si el primario cae justo después de un `COMMIT`, antes de que el cambio llegue a la réplica, ese cambio no existirá tras el failover. La ventana es de segundos y se acepta.

Lo que nunca puede pasar es un pedido a medias: la réplica solo aplica transacciones completas.

## 7. Sesión y autorización

| Decisión | Por qué |
|---|---|
| JWT en cookie `HttpOnly` y no en `localStorage` | JavaScript no puede leerlo, así que un XSS no puede robar la sesión. `SameSite=Strict` y el mismo origen cubren CSRF |
| Consultar el usuario en cada request protegida, sin caché | El bloqueo es inmediato en todas las instancias y el rol sale de la base, no del token. Una caché abriría una ventana en la que un usuario bloqueado seguiría operando. Cuesta una búsqueda por PK, del orden de 0,1 ms |
| Sesión de duración fija | El token expira a las 2 h (configurable con `JWT_EXPIRES_IN`) y se vuelve a iniciar sesión |
| Administrador creado solo por script | El registro público solo crea clientes. Ningún endpoint puede crear administradores |
| Login sin revelar si el email existe | Mensaje genérico, y verificación contra un hash ficticio cuando el usuario no existe, para que el tiempo de respuesta tampoco lo revele |
| Un administrador no puede bloquearse a sí mismo | Evita dejar el sistema sin administración por error |

## 8. Caché

### Por qué hay caché

Con el volumen del proyecto, PostgreSQL responde el catálogo en milisegundos, así que la caché no se justifica por la velocidad actual. Se justifica porque:

1. El primario es el único recurso compartido. Al sumar instancias de la API, la caché evita que se convierta en el cuello de botella.
2. El listado es la lectura más frecuente y la más cara: filtros, orden, `COUNT(*)` y búsqueda por trigramas.

### Qué se cachea

| Decisión | Por qué |
|---|---|
| Solo el listado de productos y las categorías | Son las lecturas públicas frecuentes. El detalle de un producto es una búsqueda por PK y es donde se decide comprar, así que muestra el stock real. Carrito, pedidos, usuarios e inventario deben ser exactos |
| Invalidación por versión (`INCR catalog:version`) en vez de borrar claves | Borrar tiene una carrera: una lectura lenta puede guardar datos viejos después del borrado. Con versión, esa lectura escribe bajo una clave que ya nadie consulta. Además, invalida todo el catálogo en O(1) |
| Las compras y las reseñas no invalidan; el listado vence a los 60 s | Invalidar en cada compra vaciaría la caché justo cuando hay tráfico. El detalle, el carrito y el pago siempre usan el valor real |
| Timeout de 200 ms y sin cola offline en ioredis | Por defecto, ioredis encola los comandos mientras reconecta, y una caída de Redis colgaría cada request del catálogo. Así, sin Redis, la API lee de PostgreSQL |
| Ninguna validación de negocio lee de Redis | El stock se valida siempre en PostgreSQL, dentro de la transacción |
| Redis en `data2`, junto a la réplica | La caída del primario no se lleva también la caché, y no hace falta una sexta VM |

**Descartados:**

- **Protección contra estampidas:** no se justifica a esta escala.
- **Microcaché de NGINX para el catálogo:** la invalidación quedaría fuera del control de la aplicación.
- **Caché en memoria del proceso:** divergiría entre instancias.

## 9. Imágenes y reseñas

### Imagen de producto

- **Dos opciones, excluyentes:** URL externa o archivo subido. Se admiten ambas para no depender de un servicio externo ni obligar a subir archivos.
- **Una sola imagen por producto:** al asignar una, el backend elimina la otra en la misma transacción. No se puede expresar con un CHECK, porque viven en tablas distintas.
- **Tipo por contenido (magic bytes):** el nombre y la extensión los controla quien sube el archivo.
- **Sin SVG:** puede contener scripts.
- **URLs inmutables:** cada imagen nueva recibe un `id` nuevo, así que una URL nunca cambia de contenido. Eso permite servirlas con `Cache-Control: immutable` y cachearlas en NGINX sin invalidación.

### Reseñas

| Decisión | Por qué |
|---|---|
| Solo puede reseñar quien tiene un pedido completado con ese producto | Una reseña opina sobre una compra real |
| Una reseña por cliente y producto; un segundo envío la reemplaza | Evita que un cliente infle la calificación. Se implementa con un único `INSERT … ON CONFLICT`, así que dos envíos simultáneos no chocan |
| Promedio y cantidad calculados en cada consulta, no guardados en `products` | Con el índice por producto la agregación es barata, y no hay un dato derivado que mantener sincronizado. En el listado, el resultado queda dentro de la caché de 60 s |
| Autor publicado como nombre e inicial del apellido | Evita exponer datos personales |
| Las reseñas se publican al guardarse; el administrador puede eliminarlas | Solo puede reseñar quien compró el producto, así que basta con una moderación posterior |

## 10. Frontend

| Decisión | Por qué |
|---|---|
| Módulos por bounded context, con los mismos nombres que el backend | Mismo lenguaje y fronteras explícitas en todo el sistema |
| De DDD, solo la parte estratégica (contextos, lenguaje común, fronteras); sin entidades, value objects ni casos de uso | La lógica de negocio vive en el backend. Esas capas serían copias de los DTOs y llamadas que solo reenvían, sin comportamiento propio |
| TanStack Query como única fuente del estado del servidor, incluida la sesión | Ya resuelve la caché, la invalidación y los reintentos. Un store adicional (Redux, context propio) duplicaría el estado |
| Los guards por rol son solo experiencia de usuario | La autorización real está en la API |
| CSP estricta (`script-src 'self'; style-src 'self'`) | Mitiga XSS. Obliga a no usar estilos inline, a que FontAwesome no inyecte CSS y a usar la tipografía del sistema |
| Build sin source maps y dependencias en archivos aparte | No expone el código fuente, y las dependencias siguen en la caché del navegador entre versiones |
| Moneda en quetzales (GTQ), con formato `es-GT` | Es la moneda de la tienda. El formato lo resuelve `Intl.NumberFormat`, sin librerías |

## 11. Infraestructura y operación

El porqué de la infraestructura se explica en detalle en [infraestructura-explicada.md](infraestructura-explicada.md). Ese documento cubre las VMs, la red, el balanceo, el certificado, la replicación, el failover, la caché y los despliegues. En resumen:

| Decisión | Detalle |
|---|---|
| Cinco VMs con roles separados, creadas con Vagrant y configuradas con scripts bash | [§3](infraestructura-explicada.md#3-las-máquinas-virtuales) |
| NGINX como única entrada, con round-robin y reintentos que nunca repiten un `POST` | [§6](infraestructura-explicada.md#6-nginx-y-el-balanceo-de-carga) |
| HTTPS con una CA local restringida a `edge`; HSTS desactivado | [§7](infraestructura-explicada.md#7-https-y-el-certificado) |
| API sin estado, administrada por systemd | [§8](infraestructura-explicada.md#8-las-dos-instancias-de-la-api) |
| Primario + réplica asíncrona; failover manual para evitar el split-brain sin un tercer nodo | [§9](infraestructura-explicada.md#9-postgresql-primario-y-réplica) y [§10](infraestructura-explicada.md#10-failover-cuando-se-pierde-el-primario) |
| Despliegue escalonado, con migraciones una sola vez y compatibles hacia atrás | [§13](infraestructura-explicada.md#13-despliegues-sin-cortes) |

### Entorno de desarrollo

| Decisión | Por qué |
|---|---|
| PostgreSQL y Redis en contenedores Podman durante el desarrollo | Evitan instalarlos en el equipo de desarrollo. En las VMs se instalan como servicios nativos; `dev/services.ps1` no forma parte del despliegue |
| `podman run` y no `podman compose` | Compose en Podman requiere instalar un proveedor externo |
| Mismos `roles.sql` y plantilla de ACL de Redis en desarrollo y en las VMs | Los permisos y timeouts que se prueban en desarrollo son los de las VMs |
| `@types/node` fijado en 24 | Las VMs usan Node 24 LTS. Así, aunque se desarrolle con una versión más nueva, el compilador rechaza las APIs que no existen en Node 24 |
| Dependencias solo dentro del proyecto; pnpm ejecuta scripts de instalación solo de las dependencias autorizadas en `pnpm-workspace.yaml` | Reduce el riesgo de la cadena de suministro y no deja instalaciones globales |

## 12. Límites conocidos

| Límite | Consecuencia | Siguiente paso, si hiciera falta |
|---|---|---|
| `edge` es el punto único de entrada | Si cae, el sistema queda inaccesible | Dos NGINX con keepalived y una IP virtual |
| Failover manual | Hasta que alguien ejecuta `failover.sh`, la API responde 503 | Patroni + etcd, con al menos tres nodos |
| Sin respaldos | La réplica protege ante la pérdida de una VM, pero **no ante errores lógicos**: un `DELETE` equivocado se replica en milisegundos | Respaldos periódicos con `pg_dump` o archivado de WAL |
| Redis en una sola VM | Si cae, el sistema sigue sin caché | Réplica de Redis |
| Todas las escrituras y conexiones van al primario | Con pool de 10 por instancia y `max_connections = 100`, el techo es de unas 8 instancias | PgBouncer; réplicas de lectura |
| Filas calientes | Las compras de un mismo producto se serializan en el lock de su fila: del orden de cientos por segundo por producto | Reserva de stock fuera de la fila del producto |
| systemd no detecta cuelgues | Una instancia colgada sigue «activa» hasta que se reinicia a mano; NGINX la saca del reparto mientras tanto | Watchdog de systemd |
| `deploy/secrets.env` en la carpeta compartida | Con Vagrant, el repositorio, incluido `secrets.env`, está montado en `/vagrant` en todas las VMs. Cada servicio lee solo su configuración, pero un usuario con acceso a una VM puede leer todos los secretos | Fuera de Vagrant, copiar a cada VM solo los secretos de su rol |
| Certificado de una CA local | Cada equipo que abre el sitio debe importar la CA una vez; si se recrea `edge`, la CA cambia | Let's Encrypt con un dominio real |
