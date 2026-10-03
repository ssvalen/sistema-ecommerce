# Guía técnica

Esta guía es para quien recibe el proyecto y necesita ponerlo en marcha y demostrarlo. No supone conocimientos previos del proyecto: explica qué se instala, qué comando ejecutar en cada paso, qué resultado esperar y qué scripts hay para demostrar el balanceo, la tolerancia a fallos, la replicación y la carga de datos.

## 1. Qué vas a levantar

sistema-e es una tienda en línea. Los clientes consultan el catálogo, compran con un pago simulado y reseñan productos; un administrador gestiona productos, inventario y usuarios. El sistema corre en **cinco máquinas virtuales (VMs)** dentro de tu equipo:

| VM | IP | Qué corre |
|---|---|---|
| `edge` | 192.168.56.10 | NGINX: el único punto de entrada (HTTPS) y el balanceador |
| `app1` | 192.168.56.11 | API REST, instancia `api-1` |
| `app2` | 192.168.56.12 | API REST, instancia `api-2` |
| `data1` | 192.168.56.21 | PostgreSQL primario |
| `data2` | 192.168.56.22 | PostgreSQL réplica y Redis (caché) |

**Herramientas que lo hacen posible:**

- **VirtualBox** ejecuta las VMs.
- **Vagrant** las crea y configura automáticamente, a partir del archivo `Vagrantfile` de la raíz del repositorio.
- **Los scripts de `deploy/`** instalan y configuran cada servicio.

No hace falta instalar nada dentro de las VMs a mano.

Si quieres entender el sistema antes de levantarlo, lee [arquitectura.md](arquitectura.md) e [infraestructura-explicada.md](infraestructura-explicada.md).

## 2. Requisitos del equipo anfitrión

El **anfitrión** es tu equipo, el que ejecuta las VMs.

| Requisito | Detalle |
|---|---|
| Procesador | x86-64 (Intel o AMD) con la virtualización por hardware activada en la BIOS/UEFI (Intel VT-x o AMD-V) |
| Memoria | Las VMs usan 7 GB en total. Se recomiendan 16 GB en el equipo |
| Disco | Cada VM ocupa algunos GB. Conviene tener 25 GB libres o más |
| Red | Acceso a internet durante la instalación: se descargan la imagen de Ubuntu, paquetes del sistema, Node.js y las dependencias del proyecto |
| Sistema operativo | Windows, Linux o macOS |

### Software

Instala estas tres herramientas desde sus sitios oficiales:

| Herramienta | Versión | Para qué |
|---|---|---|
| [VirtualBox](https://www.virtualbox.org/wiki/Downloads) | 7.1 o superior | Ejecuta las VMs |
| [Vagrant](https://developer.hashicorp.com/vagrant/install) | Actual | Crea y aprovisiona las VMs |
| [Git](https://git-scm.com/downloads) | Actual | Descarga el repositorio. En Windows incluye **Git Bash**, la terminal donde se ejecutan los scripts |

**Los scripts del anfitrión son scripts de bash:**

- **En Windows:** abre **Git Bash** (búscalo en el menú Inicio) y ejecuta ahí todos los comandos de esta guía. Los comandos `vagrant` funcionan igual en Git Bash.
- **En Linux y macOS:** usa la terminal del sistema.

Para comprobar la instalación, ejecuta en la terminal:

```bash
VBoxManage --version   # 7.1.x o superior
vagrant --version
git --version
```

> **Windows:** si `VBoxManage` no se encuentra, la instalación de VirtualBox no agregó su carpeta al PATH. Basta con que `vagrant --version` responda: Vagrant encuentra VirtualBox solo.

## 3. Primer arranque

### 3.1 Descargar el repositorio

```bash
git clone https://github.com/ssvalen/sistema-ecommerce.git sistema-e
cd sistema-e
```

Si recibiste el proyecto como archivo comprimido, descomprímelo y entra a su carpeta. Todos los comandos de esta guía se ejecutan **desde la raíz del repositorio**, la carpeta que contiene el `Vagrantfile`.

### 3.2 Generar los secretos

```bash
bash deploy/init-secrets.sh
```

**Qué hace el script:**

- Crea `deploy/secrets.env`, con contraseñas aleatorias para PostgreSQL, Redis y la firma de sesiones.
- Incluye las credenciales del administrador inicial:
  - `ADMIN_EMAIL=admin@sistema-e.local`;
  - `ADMIN_PASSWORD` aleatoria.
- Si el archivo ya existe, no lo modifica.

**Cuidado con este archivo:**

- No se sube al repositorio y no debe compartirse.
- **No lo borres** después de crear las VMs: los scripts lo siguen usando.

Para ver las credenciales del administrador:

```bash
grep ADMIN deploy/secrets.env
```

### 3.3 Crear las VMs

```bash
vagrant up
```

Este único comando crea las cinco VMs y deja el sistema completo funcionando. En orden:

1. **`data1`:** instala PostgreSQL como primario y crea la base de datos y sus roles.
2. **`data2`:** instala PostgreSQL como réplica (copiando `data1`) y Redis.
3. **`app1`:**
   - instala Node.js y compila la API;
   - crea las tablas (migraciones) y el usuario administrador;
   - compila la interfaz web y arranca la API.
4. **`app2`:** instala y arranca la segunda instancia de la API.
5. **`edge`:** instala NGINX con un certificado HTTPS firmado por una CA local y publica la interfaz web. La parte pública de la CA queda en `.release/tls/sistema-e-ca.crt`.

**Cuánto tarda:** la primera vez descarga la imagen de Ubuntu y muchos paquetes, así que puede tardar bastante. Es normal que pase un rato sin salida nueva.

**Cómo saber que terminó bien:** el comando termina sin líneas `ERROR`. Cada VM termina su aprovisionamiento con un mensaje como `==> PostgreSQL listo en data1` o `==> NGINX listo en edge`.

**Si falla a mitad de camino** (por ejemplo, por un corte de red), vuelve a aprovisionar solo la VM que falló, por ejemplo:

```bash
vagrant provision app1
```

Los scripts son idempotentes: repetirlos no duplica nada.

### 3.4 Comprobar que funciona

Estado de las VMs:

```bash
vagrant status        # las cinco deben decir "running"
```

Balanceo entre las dos instancias de la API, a través de NGINX:

```bash
for i in 1 2 3 4; do curl -sk https://192.168.56.10/api/v1/health; echo; done
```

Respuesta esperada, alternando entre `api-1` y `api-2`:

```json
{"data":{"status":"ok","instance":"api-1","checks":{"database":"up","cache":"up"}}}
{"data":{"status":"ok","instance":"api-2","checks":{"database":"up","cache":"up"}}}
```

## 4. Usar el sistema

| Qué | Dirección |
|---|---|
| Tienda y panel de administración | https://192.168.56.10 |
| Documentación interactiva de la API (Swagger UI) | https://192.168.56.10/api/docs |

1. **Confía en el certificado (una sola vez):** en PowerShell, desde la raíz del repositorio, importa la CA local:

   ```powershell
   Import-Certificate -FilePath .release\tls\sistema-e-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
   ```

   Windows pide confirmar; la huella debe coincidir con la que mostró el aprovisionamiento de `edge`. Cierra y vuelve a abrir el navegador y abre https://192.168.56.10: debe aparecer el candado. Si no importas la CA, el navegador muestra una advertencia que puedes aceptar con «Configuración avanzada» → «Continuar».
2. **Entra como administrador:** usa «Iniciar sesión» con `ADMIN_EMAIL` y `ADMIN_PASSWORD` de `deploy/secrets.env`. El panel está en `/admin`: productos, categorías, inventario, usuarios y pedidos de cada cliente.
3. **Entra como cliente:**
   - crea una cuenta con «Crear cuenta», o usa uno de los clientes de demostración (§6);
   - agrega productos al carrito, «Continuar al pago» y «Pagar».
4. **Demuestra el rollback desde la interfaz:** en la pantalla de pago, la casilla «Simular pago rechazado» fuerza un rechazo. El pedido queda pendiente, el stock no cambia y el pago se puede reintentar.
5. **Prueba las reseñas:** un cliente puede reseñar un producto después de comprarlo, desde la ficha del producto.

## 5. Mapa de scripts

Hay dos lugares donde se ejecutan los scripts. Es la distinción más importante de esta guía:

- **En el anfitrión:** se ejecutan como `bash deploy/<script>.sh`, desde la raíz del repositorio.
- **Dentro de una VM:** se ejecutan desde el anfitrión con `vagrant ssh <vm> -c "sudo bash /vagrant/deploy/<script>.sh"`. Dentro de cada VM, la carpeta del repositorio está montada en `/vagrant`.

### Scripts que usarás

| Script | Dónde | Para qué |
|---|---|---|
| `deploy/init-secrets.sh` | Anfitrión | Genera `deploy/secrets.env` (§3.2) |
| `deploy/app/seed-demo.sh` | VM `app1` | Carga los datos de demostración (§6) |
| `deploy/app/verify-db.sh` | VM `app1` | Verifica la estructura, los permisos y los timeouts de la base (§7) |
| `deploy/demo.sh` | Anfitrión | Demostración guiada de balanceo, fallos, replicación y failover (§8) |
| `deploy/failover.sh` | Anfitrión | Promueve la réplica cuando el primario se pierde (§9) |
| `deploy/rebuild-standby.sh` | Anfitrión | Reconstruye un nodo como réplica (§9) |
| `deploy/release.sh` | Anfitrión | Publica una versión nueva del código sin cortar el servicio (§10) |
| `deploy/db/db-node.sh status` | VM `data1` o `data2` | Muestra el rol del nodo y el estado de la replicación |

### Scripts internos

No hace falta ejecutarlos a mano: los usan Vagrant y los scripts anteriores.

| Script | Lo usa |
|---|---|
| `deploy/db/install-db.sh`, `deploy/cache/install-cache.sh`, `deploy/app/install-app.sh`, `deploy/edge/install-edge.sh` | `vagrant up` / `vagrant provision` |
| `deploy/app/deploy-app.sh`, `deploy/edge/publish-spa.sh` | `install-app.sh` y `release.sh` |
| `deploy/app/repoint-db.sh` | `failover.sh` |
| `deploy/db/db-node.sh` (resto de las operaciones) | `failover.sh`, `rebuild-standby.sh` y `demo.sh` |
| `deploy/common/lib.sh`, `deploy/common/host.sh` | Funciones compartidas de los scripts de las VMs y del anfitrión |

### Archivos de configuración del despliegue

| Archivo | Contenido |
|---|---|
| `deploy/cluster.env` | IPs, versiones y `CURRENT_PRIMARY` (el nodo que hoy es el primario). Lo modifica `failover.sh` |
| `deploy/secrets.env` | Contraseñas y administrador inicial. Lo genera `init-secrets.sh`; no se versiona |

## 6. Cargar los datos de demostración

Con la base vacía, el catálogo no tiene productos. El script de demostración carga volumen real:

```bash
vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/seed-demo.sh"
```

| Datos | Cantidad |
|---|---|
| Categorías | 12 |
| Productos (sin imagen) | 50.000 |
| Clientes | 2.000: `cliente0001@demo.local` a `cliente2000@demo.local`, todos con la contraseña `demo-cliente-123` |
| Pedidos completados, con detalle y pago | ≈20.000 |
| Reseñas | Sobre aproximadamente un tercio de las compras |

- **Duración:** tarda segundos y al terminar informa los totales.
- **Coherencia:** las unidades vendidas salen de los pedidos generados, así que el orden «Más vendidos» del catálogo es coherente.
- **Precondición:** **solo corre con el catálogo vacío.** Si ya creaste productos, se niega. Por eso conviene cargarlo justo después del primer `vagrant up`.
- **Requisito de la demo:** `demo.sh` lo necesita para los escenarios de pedidos y replicación.

## 7. Verificar la base de datos

```bash
vagrant ssh app1 -c "sudo bash /vagrant/deploy/app/verify-db.sh"
```

**Qué verifica:**

- las migraciones aplicadas;
- la cantidad de tablas, llaves, UNIQUE, CHECK e índices;
- que estén las extensiones;
- los timeouts del rol de la API;
- que ese rol **no** pueda crear ni borrar tablas;
- que los errores reales de PostgreSQL (UNIQUE, FK, CHECK, locks) se traduzcan al código HTTP correcto.

Cada línea dice `OK` o `FALLA`, y al final aparece el resultado. No deja datos en la base.

**Uso de los índices**, con los datos de demostración cargados:

```bash
vagrant ssh data1 -c "sudo -u postgres psql -d ecommerce"
```

```sql
EXPLAIN ANALYZE SELECT id FROM products WHERE name ILIKE '%lámpara%' AND deleted_at IS NULL LIMIT 20;
EXPLAIN ANALYZE SELECT id FROM products WHERE deleted_at IS NULL ORDER BY units_sold DESC, id DESC LIMIT 20;
\q
```

El plan debe mostrar `products_name_trgm_idx` (búsqueda por trigramas) y el índice de `units_sold` (popularidad).

> Después de un failover, el primario es `data2`. El valor actual está en `CURRENT_PRIMARY` de `deploy/cluster.env`.

## 8. Demostraciones con `deploy/demo.sh`

`demo.sh` usa la API real a través de NGINX, igual que un navegador. Para lo que la API no muestra, como el stock real o las filas en la réplica, consulta PostgreSQL directamente.

```bash
bash deploy/demo.sh 1      # un escenario (del 1 al 9)
bash deploy/demo.sh all    # los nueve en orden; pide Enter entre uno y otro
bash deploy/demo.sh watch  # tráfico continuo, para acompañar otra demostración
```

**Antes de empezar:**

- Carga los datos de demostración (§6).
- Comprueba que las cinco VMs estén encendidas (`vagrant status`).

| # | Escenario | Qué hace | Qué se ve |
|---|---|---|---|
| 1 | Balanceo | Seis requests a `GET /api/v1/health` | Las respuestas alternan entre `api-1` y `api-2`. El `X-Request-ID` de la última aparece en el log de la VM que la atendió |
| 2 | Instancia detenida | `systemctl stop` de la API en `app1` | Todas las respuestas llegan desde `api-2`, sin errores. Después la vuelve a arrancar |
| 3 | Reinicio automático | `kill -9` al proceso de la API en `app1` | Las respuestas siguen desde `api-2`. systemd reinicia la API en unos 2 s (`NRestarts` aumenta) |
| 4 | Caída de un host | `vagrant halt app1 --force` (apaga la VM) | El sistema sigue atendiendo desde `api-2`. Después enciende `app1`, y la API arranca sola con la VM |
| 5 | Instancia colgada | `kill -STOP` al proceso de la API en `app1` | Las requests que le tocan a `app1` tardan unos 10 s y NGINX las reintenta en `api-2`. Tras 2 fallas, `app1` sale del reparto. Con `kill -CONT` vuelve |
| 6 | Rollback | Crea un pedido y lo paga con `simulatedResult: DECLINED` | HTTP 402. El pedido sigue `PENDING_PAYMENT` y el stock no cambia. Después lo paga aprobado y el stock baja |
| 7 | Redis caído | Detiene Redis en `data2` | El catálogo responde igual, con `X-Cache: BYPASS`, y `/health` informa `degraded`. Al volver Redis, `X-Cache` pasa a `MISS` y luego a `HIT` |
| 8 | Replicación | Crea un producto como administrador | El producto aparece en la réplica (consulta de solo lectura) y se muestra el retraso de la replicación. Después lo elimina |
| 9 | Failover | Crea un pedido, apaga el primario, ejecuta `failover.sh` y reconstruye el nodo viejo | Sin primario, la API responde 503. Tras el failover vuelve a responder 200 y el pedido sigue ahí. El nodo viejo vuelve como réplica |

**Lo que hay que saber de cada escenario:**

- **El escenario 9 cambia el primario.** Al terminar, `deploy/cluster.env` queda con `CURRENT_PRIMARY=data2`, y así debe quedar mientras esas VMs existan. Para volver a `data1`, ejecuta `bash deploy/failover.sh` y después `bash deploy/rebuild-standby.sh data2`.
- **Los escenarios 8 y 9 necesitan una réplica activa.** Si no la hay, lo avisan y muestran el comando para reconstruirla.
- **Los escenarios 4 y 9 apagan y encienden VMs**, así que tardan más que el resto.
- **`watch`** envía una request a `/health` cada medio segundo y muestra la hora, el código HTTP y la instancia que respondió. Con `Ctrl+C` termina e informa cuántas no fueron 200. Úsalo en una segunda terminal mientras ejecutas `release.sh` o `failover.sh`, para mostrar cuánto se interrumpe el servicio.
- **`DEMO_BASE_URL`** cambia la URL base. Por ejemplo, `DEMO_BASE_URL=http://127.0.0.1:3000 bash deploy/demo.sh 6` corre el escenario 6 contra la API de desarrollo. Los escenarios que operan sobre las VMs requieren las VMs.

### Demostraciones a mano

Cada escenario también se puede hacer sin el script:

```bash
# Seguir los logs de una instancia (Ctrl+C para salir)
vagrant ssh app1 -c "sudo journalctl -u ecommerce-api@3000 -f"

# Ver qué instancia atendió cada request en NGINX (campo upstream=)
vagrant ssh edge -c "sudo tail -f /var/log/nginx/ecommerce.access.log"

# Detener y arrancar una instancia
vagrant ssh app1 -c "sudo systemctl stop ecommerce-api@3000"
vagrant ssh app1 -c "sudo systemctl start ecommerce-api@3000"

# Estado de la replicación (en el primario y en la réplica)
vagrant ssh data1 -c "sudo bash /vagrant/deploy/db/db-node.sh status"
vagrant ssh data2 -c "sudo bash /vagrant/deploy/db/db-node.sh status"

# Detener y arrancar Redis
vagrant ssh data2 -c "sudo systemctl stop redis-server"
vagrant ssh data2 -c "sudo systemctl start redis-server"
```

## 9. Failover y reconstrucción de la réplica

Si la VM del primario se pierde, la API responde 503 hasta que se promueve la réplica:

```bash
bash deploy/failover.sh          # pide confirmación; --yes la omite
```

**Qué hace:**

1. Verifica que la réplica esté activa.
2. Aísla el primario viejo.
3. Promueve la réplica.
4. Actualiza `CURRENT_PRIMARY` en `deploy/cluster.env`.
5. Reapunta y reinicia las dos instancias de la API, una por una.

**Después del failover**, el sistema queda **sin réplica**. Para recuperarla, enciende el nodo viejo y reconstrúyelo:

```bash
vagrant up data1                          # si estaba apagado
bash deploy/rebuild-standby.sh data1      # borra sus datos y lo copia del primario actual
```

El detalle del procedimiento y sus garantías está en [infraestructura.md §9](infraestructura.md#9-failover-y-reconstrucción).

## 10. Publicar una versión nueva

Después de modificar el código en el anfitrión:

```bash
bash deploy/release.sh
```

**Qué hace, en orden:**

1. Compila y migra en `app1`, y la reinicia.
2. Repite en `app2`, sin migrar.
3. Publica la interfaz web en `edge`.

Siempre queda una instancia atendiendo. Para comprobarlo, deja `bash deploy/demo.sh watch` corriendo en otra terminal: no debe aparecer ninguna respuesta distinta de 200.

## 11. Operación diaria

| Tarea | Comando |
|---|---|
| Estado de las VMs | `vagrant status` |
| Apagar todo | `vagrant halt` |
| Encender todo (los servicios arrancan solos) | `vagrant up` |
| Entrar a una VM (salir con `exit`) | `vagrant ssh app1` |
| Estado de la API | `vagrant ssh app1 -c "systemctl status ecommerce-api@3000"` |
| Logs de la API | `vagrant ssh app1 -c "sudo journalctl -u ecommerce-api@3000 -f"` |
| Buscar una request por su `X-Request-ID` | `vagrant ssh app1 -c "sudo journalctl -u ecommerce-api@3000 \| grep <id>"` (y lo mismo en `app2`) |
| Logs de NGINX | `vagrant ssh edge -c "sudo tail -f /var/log/nginx/ecommerce.access.log"` |
| Estado de PostgreSQL | `vagrant ssh data1 -c "systemctl status postgresql@16-main"` |
| Volver a aplicar la configuración de una VM | `vagrant provision <vm>` |

## 12. Borrar todo y empezar de cero

```bash
vagrant destroy -f
```

Elimina las cinco VMs y todos sus datos.

**Antes de volver a crearlas**, revisa que `deploy/cluster.env` diga `CURRENT_PRIMARY=data1`. Una instalación desde cero debe partir de `data1` como primario. Si un failover lo cambió, restáuralo:

```bash
git checkout deploy/cluster.env     # o edita la línea a mano
vagrant up
```

`deploy/secrets.env` se conserva y se reutiliza.

## 13. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Falta deploy/secrets.env` al ejecutar `vagrant up` | No se generaron los secretos: `bash deploy/init-secrets.sh` |
| VirtualBox no puede iniciar las VMs, o mencionan VT-x/AMD-V | La virtualización está desactivada en la BIOS/UEFI. En Windows, también pueden interferir Hyper-V o la «Integridad de memoria» |
| Las VMs no arrancan por falta de memoria | Hacen falta unos 7 GB libres. Cierra aplicaciones o apaga otras VMs |
| `/bin/bash^M: bad interpreter` al aprovisionar | Un `.sh` quedó con fin de línea de Windows (CRLF). El repositorio fuerza LF con `.gitattributes`, así que basta con volver a clonarlo con git en lugar de copiar los archivos a mano |
| En Git Bash, `vagrant ssh <vm>` (sin `-c`) no muestra el prompt | Algunas versiones de la terminal de Git Bash no manejan bien las sesiones interactivas. Antepón `winpty` (`winpty vagrant ssh app1`) o abre esa sesión desde PowerShell. Los comandos con `-c` y los scripts no se ven afectados |
| El aprovisionamiento de una VM falló por la red | `vagrant provision <vm>` lo repite desde donde haga falta |
| El navegador muestra una advertencia de seguridad | Falta importar la CA local (§4), o se entra con un nombre distinto de `192.168.56.10` o `sistema-e.local`. Si se recreó `edge`, la CA es nueva: impórtala otra vez |
| La API responde 503 en todo | La base no está disponible. Revisa PostgreSQL en el primario actual (`CURRENT_PRIMARY` en `deploy/cluster.env`) o ejecuta `failover.sh` (§9) |
| El catálogo tarda en reflejar una compra o una reseña | Es esperado: el listado se cachea 60 s. El detalle del producto muestra el stock real |
| `seed-demo.sh` dice que la base ya tiene productos | Solo corre con el catálogo vacío. Para recargar, hay que empezar de cero (§12) |
| `demo.sh` dice que no hay productos con stock | Faltan los datos de demostración (§6) |
| `demo.sh` (escenarios 8 o 9) dice que no hay réplica activa | Reconstrúyela: `bash deploy/rebuild-standby.sh <nodo>` |

## 14. Entorno de desarrollo (opcional)

Para programar con recarga en caliente sin levantar las VMs. La API y la interfaz corren directamente en el equipo; PostgreSQL y Redis, en contenedores Podman. En las VMs, en cambio, todo se instala como servicio nativo.

### Requisitos

| Software | Versión |
|---|---|
| Node.js | 24 LTS o superior |
| pnpm | 11.3.0 (la versión fijada en `package.json`): `npm install -g pnpm@11.3.0` |
| Podman | Para PostgreSQL y Redis. En Windows y macOS, crea su máquina una vez: `podman machine init` y `podman machine start` |
| PowerShell | `dev/services.ps1` es un script de PowerShell |

### Pasos

En PowerShell, desde la raíz del repositorio:

```powershell
pnpm install
Copy-Item dev\dev.env.example dev\dev.env        # contraseñas de los servicios locales
Copy-Item backend\.env.example backend\.env      # configuración de la API (mismas contraseñas)

.\dev\services.ps1 up                             # PostgreSQL 16 y Redis 7, solo en 127.0.0.1
pnpm --filter @sistema-e/backend db:migrate:deploy
pnpm create-admin                                 # admin@sistema-e.local / admin-dev-123 (de backend/.env)
pnpm seed:demo                                    # opcional: datos de demostración
pnpm dev                                          # API y SPA con recarga en caliente
```

| Qué | Dirección |
|---|---|
| Interfaz web (Vite) | http://localhost:5173 |
| API | http://127.0.0.1:3000/api/v1 |
| Swagger UI | http://127.0.0.1:3000/api/docs |

### Comandos

| Comando | Para qué |
|---|---|
| `.\dev\services.ps1 up` · `status` · `down` · `reset` | Levanta, muestra, detiene, o borra (con sus datos) los servicios locales |
| `pnpm dev` | API y SPA con recarga en caliente |
| `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm format` | Compilación, tipos, lint y formato |
| `pnpm --filter @sistema-e/backend db:migrate:deploy` | Aplica las migraciones existentes |
| `pnpm --filter @sistema-e/backend db:migrate:dev` | Crea una migración nueva a partir de cambios en `schema.prisma` |
| `pnpm --filter @sistema-e/backend db:migrate:status` | Estado de las migraciones |
| `pnpm --filter @sistema-e/backend db:verify` | La misma verificación que `verify-db.sh` (§7) |
| `pnpm create-admin` · `pnpm seed:demo` | Administrador inicial y datos de demostración |

**Diferencias con la instalación en VMs:**

- Hay una sola instancia de la API y una sola base, sin réplica.
- No hay NGINX: Vite reenvía `/api` a la API.
- La cookie de sesión no exige HTTPS (`COOKIE_SECURE=false`).

> En una red que inspecciona el tráfico HTTPS con un certificado propio, Node puede rechazar descargas, como la del motor de Prisma. Antepón `NODE_OPTIONS=--use-system-ca` para que Node use los certificados del sistema. No desactives la verificación TLS.
