# Guion de presentación técnica

Guion para presentar sistema-e a un equipo técnico, en unos 45 minutos de exposición y demostración más 15 de preguntas. Alterna explicación y demostración en vivo: cada idea de diseño se muestra funcionando sobre las cinco VMs.

Cada bloque indica:

- **Tiempo:** duración aproximada.
- **Mostrar:** qué abrir en pantalla y qué comandos ejecutar.
- **Decir:** las ideas clave, en el orden en que conviene contarlas.
- **Transición:** la frase que lleva al bloque siguiente.

Los comandos se ejecutan en **Git Bash**, desde la raíz del repositorio. El detalle técnico de cada tema está en los documentos enlazados.

## Mensajes clave

Si la audiencia se lleva solo tres ideas, que sean estas:

1. **Las dos instancias de la API son intercambiables.**
   - No guardan estado: sesión en un token, datos en PostgreSQL, caché en Redis.
   - Por eso NGINX puede repartir la carga por turno y el sistema sigue funcionando si una cae.
2. **La consistencia la garantiza la base de datos, no la suerte.**
   - Transacciones, locks de fila en orden fijo y constraints como última defensa.
   - Una compra nunca se cobra dos veces y el stock nunca queda negativo.
3. **Cada fallo tiene un comportamiento conocido y demostrable.**
   - Una instancia caída, una colgada, Redis caído o el primario perdido.
   - Todos se demuestran en vivo con un solo script.

## Preparación

### El día anterior

| Paso | Comando o acción |
|---|---|
| Levantar las VMs | `vagrant up` (la primera vez tarda bastante) |
| Cargar los datos de demostración | `vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/seed-demo.sh"`. Necesita internet: descarga un catálogo real con fotos, y crea clientes, pedidos y reseñas |
| Verificar la base | `vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/verify-db.sh"`. Debe terminar en «todo OK» |
| Importar la CA local en el equipo | PowerShell: `Import-Certificate -FilePath .release\tls\sistema-e-ca.crt -CertStoreLocation Cert:\CurrentUser\Root`, y reiniciar el navegador |
| Ensayar la demostración completa | `bash deploy/demo.sh all` |
| Dejar `data1` como primario otra vez | El escenario 9 deja `data2` como primario. Para volver: `bash deploy/failover.sh` y luego `bash deploy/rebuild-standby.sh data2` |
| Anotar las credenciales | `grep ADMIN deploy/secrets.env`. Clientes de demostración: `cliente0001@demo.local` … `cliente0200@demo.local`, con la contraseña `demo-cliente-123` |

### Quince minutos antes

```bash
vagrant status                                   # las cinco VMs en "running"
grep CURRENT_PRIMARY deploy/cluster.env          # CURRENT_PRIMARY=data1
for i in 1 2 3 4; do curl -s --cacert .release/tls/sistema-e-ca.crt https://192.168.56.10/api/v1/health; echo; done
```

Abre y deja preparados:

| Ventana | Contenido |
|---|---|
| Navegador, pestaña 1 | https://192.168.56.10 (tienda), sin sesión |
| Navegador, pestaña 2 | https://192.168.56.10/admin, con sesión de administrador |
| Navegador, pestaña 3 | https://192.168.56.10/api/docs (Swagger UI) |
| Ventana de incógnito | https://192.168.56.10, con sesión de `cliente0001@demo.local` |
| Terminal A | Raíz del repositorio, para `demo.sh` y comandos sueltos |
| Terminal B | `bash deploy/demo.sh watch`, todavía sin ejecutar |
| Presentación | Diagramas `docs/diagramas/arquitectura.png` e `infraestructura.png` |

Sube el tamaño de letra de las terminales: la audiencia va a leer códigos HTTP y nombres de instancias.

## Agenda

| # | Bloque | Tiempo | Tipo |
|---|---|---|---|
| 1 | Apertura: qué es y qué van a ver | 3 min | Exposición |
| 2 | Recorrido funcional | 7 min | Demostración |
| 3 | Arquitectura de software | 7 min | Exposición |
| 4 | Datos, transacciones y concurrencia | 6 min | Exposición + demostración |
| 5 | Infraestructura: red, NGINX y HTTPS | 8 min | Exposición |
| 6 | Resiliencia en vivo | 10 min | Demostración |
| 7 | Despliegues y operación | 2 min | Exposición |
| 8 | Límites y próximos pasos | 2 min | Exposición |
| — | Preguntas | 15 min | |

**Versión corta (20 minutos):** bloques 1, 2 (solo compra y rollback), 3 (solo el diagrama), 5 (solo el recorrido de una request) y 6 (escenarios 1, 2 y 7).

## 1. Apertura (3 min)

**Mostrar:** el diagrama de arquitectura (`docs/diagramas/arquitectura.png`).

**Decir:**

- **Qué es:** sistema-e es una tienda en línea completa, con catálogo, carrito, pedidos con pago simulado, reseñas y un panel de administración.
- **Cómo está construida:**
  - una SPA en React;
  - una API REST en Node.js y TypeScript, que corre en **dos instancias** detrás de NGINX;
  - PostgreSQL con primario y réplica;
  - Redis como caché.
- **Dónde corre:** en cinco máquinas virtuales, con servicios nativos de Linux administrados por systemd.
- **Cómo va a ser la presentación:** cada decisión de diseño se va a mostrar funcionando. Hacia el final se van a romper cosas a propósito para ver cómo responde el sistema.

**Transición:** «Primero, veamos qué hace desde el punto de vista de un usuario».

## 2. Recorrido funcional (7 min)

**Mostrar** (pestaña 1, la tienda, sin sesión):

1. **Catálogo:** búsqueda en el encabezado, barra de categorías, filtro de precio y orden «Más vendidos». La URL refleja cada filtro.
2. **Detalle de un producto:** foto, stock real, unidades vendidas, calificación promedio y reseñas.
3. **Compra, en la ventana de incógnito** (cliente):
   1. agregar dos productos al carrito y mostrar los subtotales y el total;
   2. «Continuar al pago»;
   3. en la pantalla de pago, marcar **«Simular pago rechazado»** y pagar. El pago se rechaza y el pedido queda pendiente.
   4. desmarcar la casilla y pagar de nuevo. El pedido queda completado.
4. **Bloqueo inmediato:**
   1. en la pestaña 2 (administrador), ir a `/admin/users`, abrir `cliente0001@demo.local` y bloquearlo;
   2. volver a la ventana de incógnito y abrir el carrito. La API rechaza la request: la sesión se cierra y aparece el aviso de cuenta bloqueada;
   3. desbloquearlo para seguir.
5. **Panel de administración** (pestaña 2): el historial de pedidos del cliente, `/admin/inventory` con su ajuste de stock y el editor de producto con imagen por URL o por archivo.

**Decir:**

- **Pago en dos pasos:** el pedido se crea con los precios congelados y recién el pago descuenta el stock. El rechazo simulado existe para mostrar el rollback: el pedido sigue pendiente y el inventario no cambió.
- **Bloqueo:** es inmediato, en las dos instancias. La API no confía en el rol guardado en el token: consulta al usuario en la base en cada request.
- **Reseñas:** solo puede reseñar quien compró el producto, y tiene una reseña por producto.
- **La interfaz no calcula nada:** precios, totales y stock vienen siempre del backend.

**Transición:** «Todo esto lo resuelve una sola aplicación. Veamos cómo está organizada por dentro».

## 3. Arquitectura de software (7 min)

**Mostrar:** el diagrama de arquitectura y, si hay tiempo, la carpeta `backend/src/modules/` en el editor.

**Decir:**

- **Monolito modular replicado:** una sola aplicación, dividida en módulos por contexto de negocio: `identity`, `catalog`, `inventory`, `cart`, `ordering` y `reviews`. Se despliega como una unidad y escala replicándola.
- **Por qué no microservicios:**
  - Pedido, detalle e inventario cambian juntos.
  - En una sola base, eso es una transacción con `ROLLBACK`.
  - Separados en servicios, harían falta sagas con compensaciones, y habría que operar varios servicios.
- **Fronteras entre módulos:**
  - Un módulo nunca toca las tablas de otro: usa sus funciones públicas.
  - Cada columna tiene un único módulo que la escribe. Por ejemplo, el stock solo lo cambia `inventory`.
- **Capas en cada módulo:** routes → controller → service → repository.
  - El service decide dónde empieza y termina cada transacción.
  - El repository es el único que conoce Prisma.
  - Los tipos de la base nunca llegan a una respuesta: así no se filtra un `password_hash`.
- **Contratos compartidos:** los esquemas Zod de `packages/contracts` validan en el backend, validan los formularios del frontend y generan la especificación OpenAPI. La documentación de la API no puede desalinearse de la validación.

**Mostrar:** Swagger UI (pestaña 3). Ejecutar `GET /products` con `minPrice=500&maxPrice=100` para ver un 400 con el detalle del error y la forma estándar `{ error: { code, message, details } }`.

**Transición:** «La parte más delicada de una tienda es vender sin vender de más. Veamos cómo lo garantiza la base».

## 4. Datos, transacciones y concurrencia (6 min)

**Mostrar:** el diagrama de secuencia del pago en [arquitectura.md §8](arquitectura.md#8-flujos-críticos).

**Decir:**

- **Crear el pedido (TX1):**
  - bloquea el carrito del cliente y valida stock y productos activos;
  - congela los precios;
  - no toca el inventario.
- **Pagar (TX2):**
  - bloquea el pedido y sus productos con `SELECT … FOR UPDATE`, **siempre en orden de id** para que dos pagos no se bloqueen mutuamente;
  - revalida el stock, registra el pago, descuenta el stock y suma las unidades vendidas.
  - Cualquier error revierte todo.
- **Dos clientes por la última unidad:** el segundo espera el lock, ve stock 0 y recibe 409. Si un bug se saltara esa validación, `CHECK (stock >= 0)` lo frenaría en la base: los constraints son la última defensa.
- **Nunca dos cobros:** lo impiden el lock del pedido, su estado y un `UNIQUE` en `payments.order_id`. Repetir el pago responde 409. NGINX, además, nunca reenvía un `POST` que ya llegó a una instancia.
- **Una instancia congelada a mitad de una transacción no bloquea a la otra.** El rol de la API tiene tres timeouts en PostgreSQL:

  | Timeout | Valor | Efecto |
  |---|---|---|
  | `lock_timeout` | 5 s | Quien espera un lock recibe un 503 claro |
  | `idle_in_transaction_session_timeout` | 10 s | PostgreSQL cierra la sesión congelada y libera los locks |
  | `statement_timeout` | 15 s | Ninguna consulta monopoliza la base |

- **Mínimo privilegio:** la API se conecta con un rol que solo puede leer y modificar filas. No puede crear ni borrar tablas.

**Mostrar** (opcional, terminal A): la verificación de la base, que comprueba constraints, permisos, timeouts y la traducción de errores.

```bash
vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/verify-db.sh"
```

**Transición:** «Esa es la aplicación. Ahora, dónde y cómo corre».

## 5. Infraestructura: red, NGINX y HTTPS (8 min)

**Mostrar:** el diagrama de infraestructura (`docs/diagramas/infraestructura.png`).

**Decir:**

- **Cinco VMs, cada una con un rol.** Así cada fallo se puede demostrar por separado.

  | VM | Rol |
  |---|---|
  | `edge` | Entrada |
  | `app1`, `app2` | Aplicación |
  | `data1` | Primario de PostgreSQL |
  | `data2` | Réplica de PostgreSQL y Redis |

  Redis está junto a la réplica para que la caída del primario no se lleve también la caché.
- **Red privada con firewall por VM:**
  - Solo `edge` acepta tráfico de afuera.
  - La API solo acepta conexiones desde `edge`.
  - La base, solo desde la API y desde el otro nodo de base de datos.
- **Recorrido de una request:**
  1. HTTPS hasta NGINX;
  2. NGINX elige una instancia por turno y le reenvía la request por HTTP dentro de la red privada, con un `X-Request-ID`;
  3. la API consulta PostgreSQL, o Redis para el catálogo.

  Con el `X-Request-ID` se encuentra la misma request en el log de NGINX y en el de la instancia que la atendió.
- **Por qué round-robin y no otro método:**
  - Las instancias son idénticas y las requests, cortas: repartir por turno es justo y predecible.
  - `ip_hash`, que fija cada cliente a una instancia, solo hace falta cuando la instancia guarda la sesión. Aquí, además, mandaría todo el tráfico del anfitrión a una sola instancia.
- **Cómo detecta una instancia caída:** NGINX lo nota cuando una request falla (conexión rechazada, 2 s sin conectar o 10 s sin respuesta).
  - Reintenta en la otra instancia.
  - Tras dos fallas, la saca del reparto por 10 s.
  - **No cuenta un 503 de la API como falla:** con la base caída marcaría las dos instancias como caídas y respondería un 502 genérico.
- **HTTPS con una CA local:**
  - Un certificado autofirmado cifra, pero el navegador no puede verificar quién lo emitió.
  - `edge` crea su propia autoridad certificadora y firma con ella el certificado del sitio. Basta importar la CA una vez para tener el candado.
  - La CA tiene `nameConstraints`: solo puede firmar para la IP de `edge` y para `sistema-e.local`. Aunque alguien robara su clave, no podría falsificar otros sitios.
  - Su clave privada nunca sale de `edge`.

**Mostrar:**

- En el navegador, el candado y los detalles del certificado (emisor «Sistema E - CA local»).
- La CA desde la terminal A:

  ```bash
  openssl x509 -in .release/tls/sistema-e-ca.crt -noout -subject -enddate -ext nameConstraints
  ```

**Transición:** «Dicho esto, rompamos cosas».

## 6. Resiliencia en vivo (10 min)

**Mostrar:** en la terminal B, iniciar el tráfico continuo y dejarlo visible todo el bloque. Cada línea muestra la hora, el código HTTP y la instancia que respondió.

```bash
bash deploy/demo.sh watch
```

En la terminal A, ejecutar los escenarios uno por uno:

| Escenario | Comando | Qué señalar mientras corre |
|---|---|---|
| Balanceo | `bash deploy/demo.sh 1` | Las respuestas alternan `api-1` y `api-2`. El script busca el `X-Request-ID` de la última en el log de la instancia que la atendió |
| Instancia detenida | `bash deploy/demo.sh 2` | En la terminal B todas las respuestas pasan a `api-2` y **no aparece ningún error** |
| Reinicio automático | `bash deploy/demo.sh 3` | Tras `kill -9`, systemd reinicia la API en unos 2 s; `NRestarts` aumenta |
| Instancia colgada | `bash deploy/demo.sh 5` | Las requests que le tocan a `app1` tardan unos 10 s (el timeout de NGINX) y se reintentan en `api-2`. Tras dos fallas, `app1` sale del reparto |
| Rollback | `bash deploy/demo.sh 6` | El pago rechazado da 402 y el stock en la base no cambia; el pago aprobado lo descuenta |
| Redis caído | `bash deploy/demo.sh 7` | El catálogo responde igual, con `X-Cache: BYPASS`, y `/health` informa `degraded`. Al volver Redis, `MISS` y luego `HIT` |
| Replicación | `bash deploy/demo.sh 8` | Un producto creado por la API aparece en la réplica, con una consulta directa; se muestra el retraso de la replicación |

**Decir:**

- **Escenario 2:** este es el requisito central del balanceo. Una instancia deja de existir y el usuario no se entera.
- **Escenario 3:** systemd reinicia un proceso que muere, pero no detecta uno colgado. De ese caso se encarga NGINX, con el escenario 5.
- **Escenario 7:** Redis es desechable. La API espera como máximo 200 ms y sigue con PostgreSQL. Ninguna validación de negocio depende de la caché.
- **Escenario 8:** la réplica no atiende lecturas, para que nadie deje de ver lo que acaba de escribir. Existe para tomar el relevo.

**Caché de imágenes** (opcional, terminal A). La primera respuesta dice `MISS` y la segunda `HIT`: NGINX sirve la imagen desde su disco sin tocar la API.

```bash
for i in 1 2; do curl -sI --cacert .release/tls/sistema-e-ca.crt https://192.168.56.10/api/v1/images/1 | grep -i x-cache-status; done
```

**Gran final, si el tiempo alcanza:**

```bash
bash deploy/demo.sh 9
```

El escenario tarda varios minutos, porque apaga y enciende VMs:

1. crea un pedido y espera a verlo en la réplica;
2. apaga el primario: en la terminal B aparecen respuestas 503;
3. ejecuta `failover.sh`: la API vuelve a 200 y el pedido sigue ahí;
4. reconstruye el nodo viejo como réplica.

Mientras corre, explicar:

- **Por qué el failover es manual:** con dos nodos, automatizarlo arriesga un split-brain (dos primarios aceptando escrituras). Evitarlo de forma automática exige un tercer nodo que desempate.
- **Cómo lo evita el script:** aísla el primario viejo y nunca lo reutiliza sin reconstruirlo.
- **Cuánto se pierde:** como mucho, los últimos segundos que no alcanzaron a replicarse. Nunca un pedido a medias.

**Transición:** «Romper es una parte. La otra es cambiar el sistema sin apagarlo».

## 7. Despliegues y operación (2 min)

**Decir:**

- **`release.sh` publica una versión sin cortar el servicio:**
  1. compila y migra en `app1`, la reinicia y espera a que responda;
  2. repite en `app2`;
  3. publica la interfaz web.
- **Si una instancia no queda sana,** el despliegue se detiene y la otra sigue atendiendo.
- **Las migraciones se aplican una sola vez y deben ser compatibles con la versión anterior,** porque durante unos segundos conviven las dos versiones.
- **Todo es repetible:** `vagrant destroy` + `vagrant up` reconstruye las cinco VMs desde cero, con scripts idempotentes.

**Mostrar** (opcional; tarda varios minutos porque compila en las dos VMs): `bash deploy/release.sh` en la terminal A, con la terminal B en `watch`. Al terminar, `Ctrl+C` en la terminal B muestra cuántas requests no fueron 200.

## 8. Límites y próximos pasos (2 min)

**Decir:** mostrar los límites con naturalidad da credibilidad. Cada uno tiene una solución conocida:

| Límite | Siguiente paso |
|---|---|
| `edge` es el único punto de entrada | Dos NGINX con una IP virtual (keepalived) |
| El failover es manual | Patroni + etcd, con tres nodos |
| La réplica no protege de un error humano: un borrado se replica en milisegundos | Respaldos periódicos |
| Todas las conexiones van al primario: el techo es de unas 8 instancias de la API | PgBouncer; réplicas de lectura |
| La CA local hay que importarla en cada equipo | Dominio público con Let's Encrypt |

**Cierre:** retomar los tres mensajes clave del inicio. «La documentación completa, la guía para levantarlo desde cero y los scripts de demostración están en el repositorio».

## Preguntas probables

| Pregunta | Respuesta |
|---|---|
| ¿Por qué un monolito y no microservicios? | Pedido, detalle e inventario cambian juntos. En una sola base eso es una transacción con `ROLLBACK`; separados, serían sagas con compensaciones. Los módulos con fronteras explícitas dan la separación sin ese costo |
| ¿Por qué máquinas virtuales con servicios nativos? | Cada VM es un servidor Linux completo: los servicios se instalan con los paquetes del sistema y los administra systemd. Apagar una VM simula la pérdida real de un servidor, y eso es lo que se demuestra |
| ¿No es caro consultar al usuario en cada request? | Es una búsqueda por llave primaria, del orden de 0,1 ms. A cambio, el bloqueo es inmediato en las dos instancias. Cachearla abriría una ventana en la que un usuario bloqueado sigue operando |
| ¿Por qué la sesión va en una cookie y no en `localStorage`? | La cookie `HttpOnly` no la puede leer JavaScript, así que un XSS no roba la sesión. `SameSite=Strict` y el mismo origen cubren CSRF |
| ¿Qué pasa si el catálogo muestra un stock viejo? | El listado se cachea 60 s y las compras no lo invalidan, a propósito: invalidar en cada compra vaciaría la caché justo con tráfico. El detalle, el carrito y el pago siempre leen el valor real, y el stock se valida dentro de la transacción |
| ¿Cómo se invalida la caché? | Con una versión: tras un cambio del administrador, `INCR catalog:version`. Las claves nuevas usan la versión nueva, sin la carrera de borrar claves |
| ¿Por qué las imágenes están en la base de datos? | Se replican con los datos, cambian en la misma transacción que el producto y no hace falta almacenamiento compartido entre VMs. El costo se absorbe con caché HTTP inmutable y la caché en disco de NGINX |
| ¿Por qué la réplica no atiende lecturas? | Por el retraso de replicación, alguien podría no ver lo que acaba de escribir. Las lecturas pesadas ya las absorbe Redis |
| ¿Por qué replicación asíncrona? | Con dos nodos, la síncrona haría que la caída de la réplica detuviera las escrituras del primario. Se acepta perder, como mucho, unos segundos ante la caída del primario |
| ¿Qué pasa si caen las dos instancias? | NGINX responde 502. Cada instancia vuelve sola si el proceso murió (systemd). Si cayeron las VMs, al encenderlas |
| ¿Cómo escala? | La API, sumando instancias y una línea en el upstream de NGINX. El siguiente límite es el primario de PostgreSQL: conexiones (PgBouncer) y escrituras |
| ¿Por qué una CA local y no un certificado autofirmado? | El autofirmado cifra, pero el navegador no puede confiar en él sin una excepción manual en cada visita. La CA se importa una vez, y su `nameConstraints` evita que sirva para otros sitios |
| ¿Por qué no se activa HSTS? | La CA solo es de confianza donde se importó. En otro equipo, HSTS impediría aceptar la advertencia y el sitio quedaría inaccesible |
| ¿Cómo se verificó el sistema? | Con verificación reproducible: Swagger UI para cada endpoint, `verify-db.sh` para constraints, permisos y timeouts, y `demo.sh` para balanceo, fallos, rollback, replicación y failover. La matriz de [trazabilidad](trazabilidad.md) relaciona cada requisito con su verificación |

## Si algo falla durante la demostración

| Problema | Qué hacer |
|---|---|
| El navegador muestra la advertencia del certificado | Aceptarla y seguir. Explicar que falta importar la CA en ese equipo (bloque 5) |
| Un escenario se detiene con un error | Ejecutar `vagrant status`, encender la VM que falte con `vagrant up <vm>` y repetir el escenario. Si no hay tiempo, explicarlo con la tabla de modos de fallo de [infraestructura.md §10](infraestructura.md#10-modos-de-fallo) |
| Las dos instancias no vuelven tras un escenario | `vagrant ssh app1 -c "sudo systemctl start ecommerce-api@3000"` (y lo mismo en `app2`) |
| `demo.sh` dice que no hay productos con stock | Faltan los datos de demostración (preparación) |
| Los escenarios 8 o 9 dicen que no hay réplica activa | `bash deploy/rebuild-standby.sh <nodo>`. Si no hay tiempo, omitirlos |
| Falta tiempo | Omitir los escenarios 4 y 9 y el `release.sh` en vivo, y pasar a los límites |

## Después de la presentación

- **Si se ejecutó el escenario 9:** `deploy/cluster.env` quedó con `CURRENT_PRIMARY=data2`. Para volver a `data1`: `bash deploy/failover.sh` y luego `bash deploy/rebuild-standby.sh data2`.
- **Para liberar memoria:** `vagrant halt` apaga las cinco VMs sin perder datos.
