# Infraestructura: cómo funciona y por qué

sistema-e es una tienda en línea: catálogo, carrito, pedidos con pago simulado, reseñas y un panel de administración. Este documento explica su infraestructura de punta a punta:

- qué piezas usa y para qué sirve cada una;
- cómo viaja una request desde el navegador hasta la base de datos;
- cómo se reparte la carga y qué pasa cuando algo falla;
- cómo funciona el certificado HTTPS;
- **por qué** se eligió cada cosa, frente a qué alternativas.

Está escrito para alguien que no conoce el proyecto. Los conceptos (proxy inverso, round-robin, autoridad certificadora, replicación…) se explican la primera vez que aparecen.

**Documentos relacionados:**

| Documento | Para qué consultarlo |
|---|---|
| [infraestructura.md](infraestructura.md) | La referencia literal de la configuración: cada archivo tal como queda instalado en las VMs |
| [guia-tecnica.md](guia-tecnica.md) | Los comandos para levantar el sistema y hacer las demostraciones |
| [decisiones-de-diseno.md](decisiones-de-diseno.md) | Las decisiones del software (backend, datos, caché, frontend) y los límites conocidos |

## 1. Panorama

![Diagrama de infraestructura](diagramas/infraestructura.png)

El sistema corre en **cinco máquinas virtuales (VMs)** Ubuntu Server 24.04 dentro de un mismo equipo (el **anfitrión**):

| VM | IP | Rol | Qué corre |
|---|---|---|---|
| `edge` | 192.168.56.10 | Puerta de entrada | NGINX: HTTPS, la interfaz web y el balanceo hacia la API |
| `app1` | 192.168.56.11 | Aplicación | API REST, instancia `api-1` |
| `app2` | 192.168.56.12 | Aplicación | API REST, instancia `api-2` |
| `data1` | 192.168.56.21 | Datos | PostgreSQL primario: recibe todas las lecturas y escrituras |
| `data2` | 192.168.56.22 | Datos y caché | PostgreSQL réplica (copia en espera) y Redis (caché) |

```
                       ┌──────────── red privada 192.168.56.0/24 ────────────┐
Navegador ──HTTPS:443──▶ edge (NGINX) ──HTTP:3000──▶ app1 (api-1) ──┐
                       │              └─HTTP:3000──▶ app2 (api-2) ──┤
                       │                                            ├─SQL+TLS:5432──▶ data1 (primario)
                       │                                            │                    │ replicación
                       │                                            │                    ▼
                       │                                            └─Redis:6379────▶ data2 (réplica + Redis)
                       └─────────────────────────────────────────────────────────────┘
```

**La idea central:**

- Solo `edge` recibe tráfico de afuera.
- Las dos instancias de la API son intercambiables y no guardan estado: si una cae, la otra atiende todo.
- Todos los datos viven en un único PostgreSQL primario. Una réplica lo copia continuamente, por si se pierde.
- Redis guarda en memoria las lecturas más frecuentes del catálogo. Si cae, la API lee de PostgreSQL y el sistema sigue funcionando.

### Qué usa y para qué

| Pieza | Versión | Para qué | Por qué esta |
|---|---|---|---|
| VirtualBox | 7.1+ | Ejecuta las VMs en el anfitrión | Gratuito, multiplataforma (Windows, Linux, macOS) y el proveedor mejor soportado por Vagrant |
| Vagrant | Actual | Crea y configura las cinco VMs a partir de un archivo (`Vagrantfile`) | Hace el despliegue repetible: `vagrant destroy` + `vagrant up` reconstruye todo desde cero |
| Ubuntu Server | 24.04 LTS | Sistema operativo de las VMs | Versión con soporte de largo plazo; trae PostgreSQL 16, Redis 7 y NGINX en sus repositorios oficiales |
| Box `bento/ubuntu-24.04` | — | Imagen base de cada VM | Imagen mínima y mantenida, con las Guest Additions de VirtualBox, que hacen funcionar la carpeta compartida `/vagrant` |
| NGINX | De Ubuntu 24.04 | Proxy inverso, terminación HTTPS, archivos estáticos, balanceo, caché de imágenes | Es el estándar como proxy inverso; liviano, y hace todas esas tareas con un solo proceso |
| OpenSSL | De Ubuntu 24.04 | Crea la autoridad certificadora local y el certificado del sitio | Viene instalado; no requiere software adicional |
| Node.js | 24 LTS | Ejecuta la API | Versión con soporte de largo plazo. Se instala desde NodeSource, porque Ubuntu 24.04 trae Node 18 |
| pnpm | 11.3.0 | Instala las dependencias y compila el proyecto | Es el gestor del monorepo; la versión queda fijada para que todas las VMs compilen igual |
| PostgreSQL | 16 | Base de datos relacional | Relacional, con transacciones, constraints e integridad referencial; la replicación por streaming viene incluida, sin software adicional |
| Redis | 7 | Caché del catálogo | Almacén en memoria, rápido y simple; se usa solo como caché, sin persistencia |
| systemd | De Ubuntu 24.04 | Arranca, supervisa y reinicia cada servicio; recoge sus logs | Es el administrador de servicios de Ubuntu: arranque, reinicio automático y logs sin software adicional |
| ufw | De Ubuntu 24.04 | Firewall de cada VM | Interfaz simple sobre el firewall del kernel |

## 2. Los objetivos que dieron forma a la infraestructura

Las decisiones de este documento salen de los [requisitos de infraestructura](requerimientos.md#13-infraestructura-y-despliegue) del sistema:

| Objetivo | Consecuencia en la infraestructura |
|---|---|
| Un único punto de entrada que balancee la carga | `edge` es la única VM expuesta, y reparte las requests entre dos instancias |
| Dos instancias del backend | La API no puede guardar estado propio (sesiones, caché, locks): todo va a PostgreSQL o Redis |
| Seguir atendiendo si una instancia deja de responder, y poder demostrarlo | NGINX detecta la instancia caída y reintenta en la otra, y cada instancia vive en su propia VM para poder apagarla |
| HTTPS | NGINX termina TLS con un certificado que el navegador acepta |
| Reinicio automático de los servicios | Cada servicio es una unidad de systemd con `Restart=always` |
| Despliegue repetible con scripts | Vagrant crea las VMs y un script bash por rol las configura, de forma idempotente |
| No perder los datos si se pierde el servidor de base de datos | Una réplica en espera, con failover manual |

## 3. Las máquinas virtuales

### Por qué máquinas virtuales

Una VM es una máquina Linux completa: sus servicios se instalan con los paquetes del sistema y los administra systemd, igual que en un servidor real. Además, apagar una VM simula la pérdida de un servidor completo, que es una de las demostraciones.

### Por qué cinco VMs

| Opción | Veredicto |
|---|---|
| 1 VM con todo | ✗ Las dos instancias de la API compartirían máquina: no se podría demostrar la caída de un servidor de aplicación |
| 3 VMs (NGINX, API, datos) | ✗ Igual que la anterior, y la base y su réplica en la misma máquina no protegen nada |
| 4 VMs (sin réplica) | ✗ Perder la VM de la base sería perder todos los datos |
| **5 VMs** | ✓ Cada fallo se puede demostrar por separado: una instancia, un servidor de aplicación, el primario, la caché |
| 6 VMs (Redis aparte) | ✗ Una VM más de memoria sin beneficio demostrable: Redis es desechable |

**Por qué Redis vive en `data2`, junto a la réplica, y no en `data1`:**

- Si cae el primario (`data1`), la caché sigue disponible mientras se hace el failover.
- `data2` es la máquina con menos trabajo: la réplica solo aplica cambios y no atiende consultas.

### Recursos

| VM | vCPU | RAM | Por qué |
|---|---|---|---|
| `edge` | 1 | 1 GB | NGINX consume muy poco |
| `app1`, `app2` | 1 | 1 GB | Node ejecuta el código de la aplicación en un solo hilo, así que un núcleo basta. La memoria alcanza para compilar el proyecto |
| `data1` | 2 | 2 GB | El primario recibe todas las consultas y escrituras |
| `data2` | 1 | 2 GB | La réplica aplica cambios y comparte la memoria con Redis (máximo 256 MB) |

En total son 7 GB de RAM; por eso se recomiendan 16 GB en el anfitrión.

### Cómo se crean

1. **El `Vagrantfile`** de la raíz del repositorio define las cinco VMs: nombre, IP, CPU, memoria y el script que configura cada una.
2. **`vagrant up`** descarga la imagen de Ubuntu (una sola vez), crea las VMs y ejecuta los scripts de `deploy/`. A ese paso se lo llama **aprovisionamiento**.
3. **El orden importa:**
   - el primario va primero, porque la réplica se crea copiándolo;
   - `app1` va antes que `edge`, porque compila la interfaz web que `edge` publica.
4. **Los scripts son idempotentes:** ejecutarlos dos veces deja el mismo resultado. Por eso `vagrant provision <vm>` repara una VM sin duplicar nada.
5. **Los scripts son bash puro:** toman todo de `deploy/cluster.env` y `deploy/secrets.env`, sin depender de Vagrant. Así también sirven en VMs creadas a mano o en la nube.

**La carpeta `/vagrant`:** Vagrant monta la carpeta del repositorio dentro de cada VM. Así las VMs leen los scripts y el código sin copiarlos por la red. Antes de compilar, la API copia el código a un disco local de la VM (`/opt/ecommerce/src`), porque en la carpeta compartida de VirtualBox pnpm es lento y los enlaces simbólicos, que pnpm necesita, fallan.

## 4. La red

### Dos interfaces por VM

Cada VM tiene dos tarjetas de red:

| Interfaz | Red | Para qué |
|---|---|---|
| NAT | `10.0.2.0/24`, la misma para todas | Salida a internet (descargar paquetes) y entrada de `vagrant ssh` desde el anfitrión |
| Privada (*host-only*) | `192.168.56.0/24` | Toda la comunicación entre servicios y el acceso al sitio desde el anfitrión |

**Por qué la red privada:**

- Es una red virtual entre las VMs y el anfitrión, que ocupa la IP `192.168.56.1`. **No es visible desde la red local ni desde internet**: el sitio solo se abre desde el equipo anfitrión.
- El rango `192.168.56.0/24` es el que VirtualBox usa por defecto para estas redes. En Linux y macOS, VirtualBox solo permite ese rango sin configuración adicional.
- Las IPs son fijas, así que la configuración de cada servicio puede nombrar a los demás por su IP.

**El plan de direcciones:** `.10` para la entrada, `.11`–`.12` para la aplicación y `.21`–`.22` para los datos. Agregar una tercera instancia de la API sería `.13`.

**Los servicios escuchan solo en la IP privada.** Ninguno queda expuesto en la interfaz NAT.

- **Problema:** al arrancar la VM, la IP privada aparece unos instantes después que los servicios.
- **Solución:**
  - los servicios esperan a `network-online.target`;
  - el parámetro del kernel `net.ipv4.ip_nonlocal_bind = 1` les permite enlazar esa IP aunque todavía no esté configurada.

### Firewall

Cada VM tiene `ufw` con una regla base: **todo lo entrante se rechaza**, salvo lo que se autoriza explícitamente.

| VM | Puerto | Acepta conexiones de | Por qué |
|---|---|---|---|
| `edge` | 80, 443 | Cualquiera | Es la entrada pública del sitio |
| `app1`, `app2` | 3000 | Solo `edge` | Nadie puede saltarse NGINX y hablarle directamente a la API |
| `data1`, `data2` | 5432 | `app1`, `app2` y el otro nodo de base de datos | La API consulta la base; los nodos se replican entre sí |
| `data2` | 6379 | `app1`, `app2` | Solo la API usa la caché |
| Todas | 22 | Cualquiera | `vagrant ssh` entra por la interfaz NAT, con la llave que Vagrant genera para cada VM |

**Los dos nodos de base de datos tienen las mismas reglas.** Así, cualquiera de los dos puede ser el primario sin tocar el firewall, algo indispensable para el failover (§10).

### Relojes

Todas las VMs sincronizan la hora por NTP. Sin eso:

- un token de sesión emitido por `app1` podría parecer vencido en `app2`;
- los logs de distintas máquinas no se podrían comparar.

## 5. Recorrido de una request

Qué pasa cuando un cliente abre su carrito (`GET /api/v1/cart`):

1. **Conexión cifrada.** El navegador se conecta a `https://192.168.56.10` (puerto 443).
   - NGINX presenta su certificado, y el navegador comprueba que lo firmó una autoridad en la que confía y que corresponde a esa dirección (§7).
   - Acuerdan una clave y, desde ahí, todo viaja cifrado.
2. **NGINX decide qué hacer según la ruta:**
   - `/api/…` va a la API;
   - `/assets/…` y `/` son archivos de la interfaz web, que sirve él mismo desde el disco;
   - `/api/v1/images/…` va a la API, pero pasa por su caché de imágenes.
3. **NGINX elige una instancia.** Por turno: una request a `api-1`, la siguiente a `api-2` (§6).
   - Genera un identificador único, `X-Request-ID`.
   - Reenvía la request por HTTP plano, dentro de la red privada, al puerto 3000 de la instancia elegida.
4. **La API atiende la request:**
   - verifica la cookie de sesión;
   - consulta al usuario en PostgreSQL (para saber si está bloqueado);
   - lee el carrito y responde.

   Todas sus líneas de log llevan el `X-Request-ID` y el nombre de la instancia.
5. **PostgreSQL**, en el primario, ejecuta las consultas. La conexión entre la API y la base también va cifrada.
6. **La respuesta vuelve por NGINX** al navegador, con el mismo `X-Request-ID`.

   Con ese identificador se puede encontrar la request en tres lugares:
   - el log de acceso de NGINX, que además dice a qué instancia fue;
   - el log de la API que la atendió;
   - la respuesta que recibió el navegador.

Si en lugar del carrito fuera el listado del catálogo (`GET /api/v1/products`), en el paso 4 la API buscaría primero en Redis y solo iría a PostgreSQL si el resultado no está en la caché.

## 6. NGINX y el balanceo de carga

NGINX cumple cinco funciones en `edge`:

| Función | Qué significa |
|---|---|
| Proxy inverso | Recibe las requests en nombre de la API y las reenvía. El navegador nunca habla con la API directamente |
| Terminación TLS | Descifra HTTPS. Detrás de él, el tráfico va por HTTP dentro de la red privada |
| Servidor estático | Entrega la interfaz web (HTML, JavaScript, CSS) sin pasar por la API |
| Balanceador | Reparte las requests de la API entre las dos instancias |
| Caché de imágenes | Guarda en disco las imágenes de productos que sirve la API |

**Por qué un solo punto de entrada:**

- La interfaz, la API y las imágenes salen del mismo origen (`https://192.168.56.10`), así que el navegador no necesita permisos entre dominios (CORS).
- La cookie de sesión puede ser `SameSite=Strict`, la protección más fuerte contra CSRF.
- Solo una máquina queda expuesta.

### Cómo reparte: round-robin

El grupo de servidores de la API se define así:

```nginx
upstream ecommerce_api {
    server 192.168.56.11:3000 max_fails=2 fail_timeout=10s;
    server 192.168.56.12:3000 max_fails=2 fail_timeout=10s;
    keepalive 16;
}
```

**Round-robin** es el método por defecto: las requests se asignan por turno (`api-1`, `api-2`, `api-1`, `api-2`…). Seis llamadas seguidas a `/api/v1/health` muestran la alternancia, porque la respuesta incluye el nombre de la instancia.

**Por qué round-robin y no otro método:**

| Método | Cómo reparte | Veredicto |
|---|---|---|
| **Round-robin** | Por turno | ✓ Las instancias son idénticas y no guardan estado, y las requests son cortas y parecidas: repartir por turno es justo y predecible |
| `least_conn` | A la instancia con menos conexiones abiertas | Sirve cuando hay requests muy largas. Aquí todas duran milisegundos, así que el resultado sería casi el mismo y la demostración menos predecible |
| `ip_hash` | Siempre a la misma instancia según la IP del cliente | ✗ Sirve cuando la instancia guarda la sesión, que aquí no ocurre. Además, todo el tráfico de la demo sale del anfitrión (`192.168.56.1`): iría siempre a la misma instancia y no habría balanceo |

**Por qué el balanceo funciona sin sticky sessions** (sin fijar un cliente a una instancia):

- la sesión es un token firmado en una cookie, que cualquier instancia verifica con el mismo secreto;
- el carrito, los pedidos y el stock están en PostgreSQL;
- la caché está en Redis, compartida por las dos instancias.

**`keepalive 16`:** NGINX mantiene abiertas hasta 16 conexiones ociosas hacia la API y las reutiliza, en lugar de abrir una conexión TCP por request.

- **Riesgo:** si Node cerrara una de esas conexiones justo cuando NGINX va a reutilizarla, el usuario recibiría un error 502.
- **Solución:** la API las mantiene abiertas 65 s, más que los 60 s que NGINX espera antes de cerrarlas. Así siempre cierra NGINX primero.

### Cómo detecta una instancia caída

NGINX de código abierto no consulta periódicamente a las instancias para saber si están vivas; no tiene health checks activos. Se da cuenta **cuando una request falla** (health checks pasivos):

| Situación | Qué ve NGINX | Cuánto tarda en notarlo |
|---|---|---|
| El proceso de la API murió | La conexión se rechaza al instante | Inmediato |
| La VM está apagada | La conexión no se establece | `proxy_connect_timeout`: 2 s |
| El proceso está colgado (vivo, pero sin responder) | La conexión se acepta, pero la respuesta no llega | `proxy_read_timeout`: 10 s |

**Qué hace cuando una request falla** (`proxy_next_upstream error timeout`):

1. La reintenta en la otra instancia, con un máximo de 2 intentos y 15 s en total. El usuario recibe la respuesta de la instancia sana; solo nota la demora.
2. Cuenta la falla. Con 2 fallas dentro de 10 s (`max_fails=2 fail_timeout=10s`), saca a la instancia del reparto durante 10 s: todo va a la otra.
3. Pasados esos 10 s, le envía una request de prueba. Si responde, vuelve al reparto; si no, otros 10 s fuera.

**Ejemplo: `app1` se apaga.**

- Las primeras requests que le tocan esperan 2 s y se reintentan en `api-2`.
- A la segunda falla, `app1` sale del reparto y todo lo atiende `api-2`, sin demora.
- Cuando `app1` vuelve a encenderse, la API arranca sola con la VM, y NGINX la reincorpora en su siguiente prueba.

### Reintentos seguros: nunca dos compras

NGINX **no** reintenta un `POST` ni un `PATCH` que ya llegó a una instancia. Es su comportamiento por defecto, y se mantiene a propósito.

- **El riesgo:** si la primera instancia ya procesó el pago y se colgó antes de responder, reenviarlo cobraría dos veces.
- **Cuándo sí reintenta:** cuando la request nunca llegó, por una conexión rechazada o que no se estableció. Eso es seguro para cualquier método.
- **El costo:** si una instancia se cuelga con un `POST` en curso, ese `POST` falla con un error 504, y el usuario lo repite. Repetirlo es seguro: el sistema rechaza un segundo pago del mismo pedido.

**Los 503 de la API no se cuentan como fallas.** La API responde 503 cuando la base de datos no está disponible. Si NGINX lo tomara como falla de la instancia, con la base caída sacaría del reparto a las dos instancias y respondería un error 502 genérico. Así, en cambio, el usuario recibe el mensaje claro de la API.

### La cadena de tiempos límite

Los timeouts de cada capa están ordenados para que, ante un problema, falle primero la capa que mejor puede explicarlo:

| Tiempo | Dónde | Para qué |
|---|---|---|
| 200 ms | Comandos a Redis | Si Redis no responde, la API pasa a PostgreSQL casi sin demora |
| 1 s | Cada verificación de `/health` | El endpoint de salud responde rápido aunque una dependencia esté caída |
| 2 s | Conexión de NGINX a la API | Detecta rápido una VM apagada |
| 5 s | Espera de un lock en PostgreSQL (`lock_timeout`) | Una request bloqueada por otra recibe un 503 claro, antes de que NGINX se rinda |
| 10 s | Transacción en la API (Prisma) | Mayor que el `lock_timeout`, para que el error que llegue sea el de PostgreSQL, que dice qué pasó |
| 10 s | Respuesta de la API a NGINX (`proxy_read_timeout`) | Detecta una instancia colgada |
| 10 s | Transacción abierta sin actividad (`idle_in_transaction_session_timeout`) | Si una instancia se congela a mitad de una transacción, PostgreSQL cierra su sesión y libera los locks que bloqueaban a la otra |
| 10 s | Apagado ordenado de la API | Termina las requests en curso al detenerse |
| 15 s | Consulta en PostgreSQL (`statement_timeout`) | Última defensa: ninguna consulta monopoliza la base |
| 15 s | Reintentos de NGINX (`proxy_next_upstream_timeout`) | Límite total de una request, contando el reintento |
| 15 s | systemd espera el apagado (`TimeoutStopSec`) | Margen para el apagado ordenado de 10 s |

Las consultas normales terminan en milisegundos: estos límites solo actúan cuando algo falla.

### Interfaz web, caché de imágenes y cabeceras

- **Interfaz web:**
  - `index.html` se sirve con `no-cache`: el navegador siempre pregunta si hay una versión nueva.
  - Los archivos de `/assets/` llevan un hash del contenido en el nombre (`index-3f2a9c.js`). Un cambio produce un nombre nuevo, así que se pueden cachear un año (`immutable`).
  - Cualquier otra ruta (`/cart`, `/admin/products`) devuelve `index.html`, y el enrutador de la aplicación en el navegador muestra la pantalla correcta.
- **Caché de imágenes:**
  - Las imágenes subidas se guardan en PostgreSQL, para que se repliquen con los datos.
  - La primera vez que alguien pide una imagen, NGINX la obtiene de la API y la guarda en disco. Desde ahí, la sirve él mismo, sin tocar la API ni la base.
  - Cada imagen nueva tiene una URL nueva, así que esa caché nunca queda desactualizada.
  - La cabecera `X-Cache-Status` (`MISS` o `HIT`) muestra de dónde salió.
- **Cabeceras de seguridad de la interfaz:**
  - **Content-Security-Policy:** el navegador solo ejecuta scripts y estilos servidos por el propio sitio. Mitiga la inyección de código (XSS).
  - **X-Frame-Options:** impide incrustar el sitio en otra página (clickjacking).
  - **X-Content-Type-Options:** impide que el navegador adivine el tipo de un archivo.
  - **Referrer-Policy:** limita qué se informa a otros sitios al seguir un enlace.

  Las respuestas de la API llevan sus propias cabeceras, que pone la API con helmet.
- **`server_tokens off`:** NGINX no anuncia su versión.
- **`client_max_body_size 3m`:** cubre la imagen más grande admitida (2 MB) y rechaza cuerpos mayores antes de que lleguen a la API.

## 7. HTTPS y el certificado

### Qué resuelve HTTPS

HTTPS es HTTP dentro de una conexión cifrada con TLS. Garantiza dos cosas:

1. **Confidencialidad:** nadie en el camino puede leer las contraseñas, la cookie de sesión ni los datos.
2. **Autenticidad:** el navegador comprueba que habla con el servidor correcto y no con un impostor.

En este proyecto, además, la cookie de sesión es `Secure`: el navegador solo la envía por HTTPS. Sin HTTPS no se podría iniciar sesión.

### Dónde se cifra: terminación en `edge`

TLS termina en NGINX. De NGINX a la API, el tráfico va por HTTP plano.

| Opción | Veredicto |
|---|---|
| **TLS solo en NGINX** | ✓ Un solo certificado que administrar. El tramo sin cifrar va por una red privada a la que solo llega `edge`, porque el firewall de `app1` y `app2` no acepta a nadie más |
| TLS también entre NGINX y la API | Más seguro ante un atacante dentro de la red privada, pero exige certificados en cada instancia. Desproporcionado para una red privada de cinco VMs |

La conexión entre la API y PostgreSQL sí va cifrada (§9), porque transporta las contraseñas de la base y todos los datos.

**Cómo se configura TLS en NGINX:**

- **Versiones:** solo TLS 1.2 y 1.3. Las anteriores tienen debilidades conocidas.
- **HTTP/2:** varias requests viajan en paralelo por una sola conexión.
- **Caché de sesiones TLS** (10 MB, un día): un navegador que vuelve no repite el saludo completo.
- **Redirección:** el puerto 80 responde `301` hacia HTTPS, así que `http://192.168.56.10` lleva al sitio seguro.

### Conceptos: certificado, CA y cadena de confianza

- **Certificado:** un documento digital que dice «esta clave pública pertenece a `192.168.56.10`», firmado por alguien.
- **Autoridad certificadora (CA):** quien firma certificados. Los sistemas operativos y navegadores traen una lista de CAs en las que confían, como Let's Encrypt o DigiCert.
- **Cadena de confianza:** el navegador acepta un certificado si lo firmó una CA de su lista y si el nombre o la IP con que se entró aparece en el certificado (campo `subjectAltName`).

### Las opciones que había

| Opción | Cómo se ve en el navegador | Veredicto |
|---|---|---|
| Certificado autofirmado (se firma a sí mismo) | Advertencia de sitio no seguro en cada equipo, sin forma limpia de evitarla | ✗ Cifra igual, pero el navegador no puede verificar quién lo emitió. Era la solución anterior del proyecto |
| Certificado público (Let's Encrypt) | Candado, sin hacer nada | ✗ Exige un dominio público que apunte al servidor. Aquí el sitio vive en una red privada sin dominio |
| **CA local propia** | Candado, en los equipos que importaron la CA | ✓ Se importa una sola vez y todos los certificados que firme quedan aceptados. No depende de internet ni de un dominio |

### Cómo está construida la CA local

`install-edge.sh` la crea en `edge` la primera vez que se aprovisiona, con OpenSSL. Queda en `/etc/nginx/tls/ca/` y dura 10 años.

| Propiedad | Valor | Qué significa |
|---|---|---|
| Nombre | `Sistema E - CA local` | Así aparece en el almacén de certificados del equipo |
| Clave | RSA de 3072 bits, firma SHA-256 | Más larga que la del sitio, porque vive más tiempo |
| `basicConstraints=critical,CA:TRUE,pathlen:0` | Es una CA, pero no puede crear CAs intermedias | Solo puede firmar certificados finales |
| `keyUsage=keyCertSign,cRLSign` | Solo sirve para firmar certificados | No puede usarse como certificado de un sitio |
| `nameConstraints=permitted;IP:192.168.56.10/32,permitted;DNS:sistema-e.local` | **Solo puede firmar para `edge`** | Ver abajo |

**Por qué `nameConstraints` es importante:**

- **El riesgo:** importar una CA como raíz de confianza le da mucho poder. Si alguien robara una CA sin restricciones, podría fabricar un certificado válido para cualquier sitio (por ejemplo, un banco), y el equipo lo aceptaría.
- **La protección:** esta CA está restringida a la IP `192.168.56.10` y al nombre `sistema-e.local` (y sus subdominios). El navegador rechaza cualquier certificado que firme para otro nombre.
- **El resultado:** aunque alguien obtuviera su clave privada, no podría usarla contra otros sitios.

### Cómo está construido el certificado del sitio

Lo firma la CA local y lo usa NGINX (`/etc/nginx/tls/ecommerce.crt`):

| Propiedad | Valor | Qué significa |
|---|---|---|
| `subjectAltName` | `IP:192.168.56.10`, `DNS:sistema-e.local` | Las dos formas válidas de entrar al sitio. Los navegadores solo miran este campo, no el nombre común |
| `basicConstraints=CA:FALSE` | No es una CA | No puede firmar otros certificados |
| `keyUsage`, `extendedKeyUsage=serverAuth` | Solo sirve para identificar un servidor web | No sirve para firmar código ni correos |
| Clave | RSA de 2048 bits, firma SHA-256 | Estándar actual para certificados de sitio |
| Vigencia | 397 días | Dentro del máximo de 398 días que los navegadores exigen a los certificados públicos. Con una CA local no es obligatorio, pero mantiene el certificado dentro de lo que cualquier cliente acepta |
| Número de serie | Aleatorio, de 128 bits | Dos certificados nunca comparten número de serie |

**Renovación automática.** Cada vez que se aprovisiona `edge`, el script revisa el certificado y lo vuelve a emitir si:

- no existe;
- no lo firmó la CA actual (por ejemplo, el autofirmado de una instalación anterior);
- no cubre la IP de `edge` (si cambió `EDGE_IP` en `cluster.env`);
- vence en menos de 30 días.

En cualquier otro caso lo conserva. Para renovarlo basta con `vagrant provision edge`.

### Dónde quedan las claves

| Archivo | Dónde | Permisos | Sale de `edge` |
|---|---|---|---|
| Clave privada de la CA (`ca.key`) | `/etc/nginx/tls/ca/` | Solo root (0600) | **Nunca** |
| Clave privada del sitio (`ecommerce.key`) | `/etc/nginx/tls/` | Solo root (0600) | **Nunca** |
| Certificado de la CA (`ca.crt`) | `/etc/nginx/tls/ca/` y una copia en `.release/tls/sistema-e-ca.crt` | Público | Sí: es lo que se importa en el anfitrión |

`.release/tls/` es una carpeta del repositorio en el anfitrión, excluida de git. `edge` la escribe a través de la carpeta compartida `/vagrant`.

Al terminar, `install-edge.sh` comprueba que todo encaje y muestra dos cosas:

- el resultado de conectarse al propio sitio validando contra la CA (sin desactivar la verificación);
- la **huella SHA-256** de la CA, para compararla al importarla.

### Cómo se confía en la CA

Se importa **una sola vez** en el equipo que abre el sitio. En Windows (usuario actual, sin permisos de administrador), desde PowerShell en la raíz del repositorio:

```powershell
Import-Certificate -FilePath .release\tls\sistema-e-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

- **Confirmación:** Windows pide confirmar y muestra la huella. Debe coincidir con la que mostró el aprovisionamiento de `edge`.
- **Navegadores que la usan:** Chrome y Edge usan el almacén de Windows. Después de importarla, hay que cerrar el navegador y volver a abrirlo.

En otros sistemas (estos comandos son los estándar de cada sistema operativo; los scripts del proyecto no los ejecutan):

| Sistema | Cómo importarla |
|---|---|
| macOS | `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .release/tls/sistema-e-ca.crt` |
| Linux | Chrome y Firefox usan su propio almacén: importarla desde la configuración del navegador, en la sección de certificados o autoridades |
| Firefox (cualquier sistema) | Si muestra advertencia aunque la CA esté en el sistema: Configuración → Privacidad y seguridad → Certificados → Ver certificados → Autoridades → Importar |

**Para quitarla en Windows:** `certmgr.msc` → «Entidades de certificación raíz de confianza» → «Sistema E - CA local» → Eliminar.

**Para comprobar la cadena sin navegador** (desde Git Bash, en la raíz del repositorio):

```bash
curl --cacert .release/tls/sistema-e-ca.crt https://192.168.56.10/api/v1/health
openssl s_client -connect 192.168.56.10:443 -CAfile .release/tls/sistema-e-ca.crt </dev/null | grep "Verify return code"
#   Verify return code: 0 (ok)
openssl x509 -in .release/tls/sistema-e-ca.crt -noout -subject -enddate -fingerprint -sha256
```

### Lo que hay que saber

- **Nombre con que se entra:** solo `https://192.168.56.10` o `https://sistema-e.local`. El segundo requiere agregar `192.168.56.10 sistema-e.local` al archivo `hosts` del anfitrión. Con cualquier otro nombre, el certificado no coincide.
- **Si se destruye `edge`, la CA cambia:** se crea una CA nueva y hay que importarla otra vez. Conviene borrar la anterior del almacén.
- **Sin la CA importada**, el sitio funciona igual y va cifrado. El navegador solo muestra una advertencia, que se puede aceptar.
- **HSTS está desactivado.** HSTS es una cabecera que obliga al navegador a no aceptar nunca advertencias de certificado para ese sitio. Como la CA solo es de confianza donde se importó, en cualquier otro equipo HSTS dejaría el sitio inaccesible.
- **Con un dominio público**, la CA local se reemplaza por Let's Encrypt (`certbot --nginx -d <dominio>`) y se activa HSTS.

## 8. Las dos instancias de la API

### Qué las hace intercambiables

Una instancia es **sin estado** si no guarda nada que otra instancia necesite. En sistema-e:

| Estado | Dónde vive | Por qué ahí |
|---|---|---|
| Sesión | En la cookie, como un token JWT firmado | Cualquier instancia lo verifica con el mismo secreto: no hace falta compartir un almacén de sesiones |
| Carrito, pedidos, stock, imágenes, reseñas | PostgreSQL | Una sola fuente de verdad para las dos |
| Caché | Redis | Si cada instancia tuviera su caché en memoria, mostrarían datos distintos |
| Control de concurrencia | Locks de fila en PostgreSQL | Un lock en la memoria de una instancia no protege de la otra |
| Identificadores y fechas | Los genera PostgreSQL | No dependen del reloj ni del contador de cada instancia |

Por eso cualquier request puede ir a cualquier instancia, y agregar capacidad es sumar una VM y una línea en el `upstream` de NGINX.

### Por qué systemd

systemd es el administrador de servicios de Ubuntu. La API corre como la unidad `ecommerce-api@3000`:

- **Arranca sola** al encender la VM.
- **Se reinicia sola** si el proceso muere (`Restart=always`, a los 2 s). Si falla al arrancar más de 10 veces en un minuto, systemd deja de intentarlo, para no quedar en un bucle.
- **Sus logs van a journald:** `journalctl -u ecommerce-api@3000`. La API escribe una línea JSON por evento.
- **Es una plantilla** (`@` en el nombre): el puerto va en el nombre de la unidad (`@3000`). Para correr una segunda instancia en la misma VM bastaría con `ecommerce-api@3001`.

**Alcance del reinicio automático:** systemd detecta que un proceso **murió**, no que se **colgó**. Una instancia colgada sigue «activa» para systemd. En ese caso, quien la saca del reparto es NGINX, por timeout (§6).

**Endurecimiento.** La unidad limita lo que puede hacer el proceso, de modo que una vulnerabilidad en la API tenga poco alcance:

- corre como el usuario `ecommerce`, sin shell ni privilegios;
- ve el sistema de archivos en solo lectura y no ve los directorios personales;
- no puede ganar privilegios ni cargar módulos del kernel;
- solo puede usar las llamadas al sistema de un servicio común.

**Apagado ordenado.** Al detenerla (`systemctl stop` o un despliegue), systemd envía la señal `SIGTERM` y la API:

1. deja de aceptar conexiones nuevas;
2. termina las requests en curso (hasta 10 s);
3. cierra las conexiones a PostgreSQL y Redis.

Así un despliegue no corta las requests que ya estaban en proceso.

### Configuración y salud

- **Configuración:** cada instancia lee la suya de `/etc/ecommerce/ecommerce.env`: IP en la que escucha, nombre de la instancia, dirección del primario, Redis y secretos. Al arrancar, valida cada variable. Si falta alguna, termina con un mensaje claro, sin mostrar los valores.
- **Salud:** `GET /api/v1/health` responde qué instancia contestó y el estado de sus dependencias.

  | Estado | Significado |
  |---|---|
  | `ok` | Todo disponible |
  | `degraded` | Sin Redis: la instancia funciona, más lenta |
  | `unavailable` | Sin base de datos (responde 503) |

  Los scripts de despliegue y failover lo usan para saber cuándo una instancia quedó lista.

## 9. PostgreSQL: primario y réplica

### Por qué una réplica

| Opción | Veredicto |
|---|---|
| Una sola base | ✗ Perder la VM es perder todos los datos |
| Una sola base con respaldos | ✗ Protege los datos, pero no la disponibilidad, y se pierde todo lo ocurrido desde el último respaldo |
| **Primario + réplica en espera, failover manual** | ✓ Ante la pérdida del primario se pierden, como mucho, unos segundos de datos, y el servicio vuelve en minutos. Es una función nativa de PostgreSQL |
| Failover automático (Patroni + etcd + IP virtual) | ✗ Requiere al menos 3 nodos de consenso para decidir sin equivocarse quién es el primario, y software adicional para coordinarlos |

### Cómo funciona la replicación

- **El registro de cambios (WAL):** PostgreSQL anota cada cambio en el *write-ahead log* antes de aplicarlo a las tablas.
- **Streaming:** la réplica se conecta al primario como el usuario `replicator` y recibe ese registro en tiempo real. Lo aplica sobre su propia copia, que queda idéntica a la del primario con un retraso normalmente menor a un segundo.
- **Slot de replicación:** el primario guarda un *slot* para la réplica, un marcador de hasta dónde la réplica recibió el registro. Si la réplica se desconecta, el primario conserva el registro que le falta (hasta 1 GB), y al volver se pone al día sola. El límite evita que una réplica caída llene el disco del primario.
- **Copia inicial:** la réplica se crea copiando el primario completo con `pg_basebackup`, y desde ahí sigue por streaming.
- **Hot standby:** la réplica acepta consultas de solo lectura. El sistema no las usa, pero la demostración las aprovecha para mostrar que un dato nuevo ya llegó.

### Asíncrona, y por qué

En la replicación **asíncrona**, el primario confirma una transacción sin esperar a la réplica.

| Modo | Ventaja | Problema con dos nodos |
|---|---|---|
| Síncrona | Ninguna transacción confirmada se pierde | Si la réplica cae, el primario deja de aceptar escrituras: la réplica, que debía proteger, se vuelve un segundo punto de falla |
| **Asíncrona** | El primario sigue funcionando aunque la réplica caiga | Si el primario cae justo después de confirmar, se pueden perder esos últimos segundos |

Se aceptó esa ventana de segundos. Lo que nunca ocurre es un pedido a medias: la réplica solo aplica transacciones completas.

### Por qué la réplica no atiende lecturas

**El problema:** usarla para leer repartiría la carga, pero por el retraso de replicación alguien podría no ver lo que acaba de escribir. Por ejemplo, el administrador guarda un producto, la página se recarga leyendo de la réplica y el cambio todavía no aparece.

**Por qué no hace falta:** las lecturas más frecuentes, las del catálogo, ya las absorbe Redis.

### Seguridad de la base

- **Quién puede conectarse:**
  - solo las IPs de `app1` y `app2`, para los roles de la aplicación;
  - solo el otro nodo, para la replicación.

  Lo controlan el firewall y `pg_hba.conf`.
- **Conexiones cifradas** (`hostssl`) y contraseñas con `scram-sha-256`, que nunca viajan en claro.
- **El certificado de la base** es el autofirmado que Ubuntu genera al instalar. La API cifra la conexión sin verificarlo (`DB_SSL_MODE=require`).
  - **Por qué no va en la URL:** el driver de PostgreSQL para Node (node-postgres 8) trata un `sslmode=require` en la URL de conexión como «verificar el certificado por completo», y el autofirmado no lo pasaría. Por eso la URL no lleva `sslmode`, y el cifrado se configura aparte con `DB_SSL_MODE`.
  - **Riesgo:** esto protege contra quien escucha la red, no contra un impostor dentro de ella.
  - **Mitigación:** dentro de una red privada restringida por firewall, es un compromiso razonable.
- **Mínimo privilegio:** la API usa el rol `ecommerce_app`, que solo puede leer y modificar filas. Las tablas solo las cambia `ecommerce_owner`, y solo durante un despliegue.
- **Timeouts en el rol de la API:** una instancia congelada no puede bloquear a la otra indefinidamente (§6).

## 10. Failover: cuando se pierde el primario

**Failover** es convertir la réplica en el nuevo primario.

**Por qué es manual:** el riesgo de automatizarlo con solo dos nodos es el **split-brain**. Si la red entre ellos se corta, la réplica podría creer que el primario murió y promoverse mientras el primario sigue vivo. Quedarían dos primarios aceptando escrituras distintas, imposibles de reconciliar. Evitarlo de forma automática exige un tercer nodo que desempate y un sistema de consenso. Con failover manual, una persona confirma que el primario realmente se perdió.

### Qué hace `deploy/failover.sh`

1. **Verifica que la réplica esté activa.** Si no lo está, se detiene, para no promover por error al primario viejo.
2. **Aísla el primario viejo** (*fencing*). Si su VM responde, detiene PostgreSQL y lo enmascara, para que ni un reinicio lo vuelva a levantar.
3. **Promueve la réplica:** deja de seguir al primario y empieza a aceptar escrituras.
4. **Anota el nuevo primario** en `CURRENT_PRIMARY`, en `deploy/cluster.env`.
   - Ese valor es la fuente de verdad: lo leen los scripts, las VMs (por `/vagrant`) y el `Vagrantfile`.
   - Si se vuelve a aprovisionar, el `Vagrantfile` respeta qué nodo es el primario.
5. **Reapunta la API**, una instancia por vez.
   - Cambia la dirección de la base en la configuración y reinicia la instancia.
   - Espera a que responda antes de pasar a la otra.
   - Hay que reiniciar porque Prisma, la librería de acceso a datos, no puede elegir entre varios servidores por sí sola.

**Cuánto se pierde y cuánto tarda:**

| Medida | Valor |
|---|---|
| Datos perdidos | Como mucho, los últimos segundos que no alcanzaron a replicarse |
| Tiempo sin servicio | Desde la caída hasta que alguien ejecuta el script, más lo que tarda el script (minutos) |

### Después: volver a tener réplica

Tras el failover, el sistema funciona **sin réplica**. `deploy/rebuild-standby.sh <nodo>` convierte el nodo viejo en réplica del nuevo primario:

1. borra sus datos;
2. crea un slot nuevo en el primario;
3. copia todo con `pg_basebackup`.

**Por qué copiar todo y no reparar** (`pg_rewind`): es más simple y no requiere activar opciones adicionales en PostgreSQL. Con este volumen de datos tarda poco.

**Barreras contra el split-brain:**

- `failover.sh` aísla el primario viejo si responde.
- Los scripts de instalación se niegan a reinstalar como primario a un nodo que no sea `CURRENT_PRIMARY`, y a borrar un nodo que todavía tiene la base. Ni `vagrant provision` lo revive.
- Aunque el primario viejo arrancara por error, la API ya apunta al nuevo, así que nadie le escribiría.

## 11. Redis: la caché

**Por qué hay caché:** con el volumen del proyecto, PostgreSQL responde el catálogo en milisegundos. La caché no está para ir más rápido hoy, sino para que el primario, que es el único recurso compartido, no se vuelva el cuello de botella al agregar instancias. El listado del catálogo es la lectura más frecuente y la más cara (filtros, orden, conteo y búsqueda de texto).

**Qué se cachea:** solo el listado de productos (60 s) y las categorías (10 min). El detalle del producto, el carrito, los pedidos y todo lo administrativo siempre se leen de PostgreSQL. Ninguna validación de negocio, como el stock, lee de Redis.

**Cómo está configurado:**

| Configuración | Por qué |
|---|---|
| Sin persistencia (`save ""`, `appendonly no`) | Es una caché: si se pierde, se reconstruye sola desde PostgreSQL. Guardarla en disco no aporta |
| `maxmemory 256mb` con `allkeys-lru` | Al llenarse, descarta lo menos usado en vez de fallar. Deja memoria a la réplica de PostgreSQL, que comparte la VM |
| Usuario ACL `ecommerce_app` | La API solo puede tocar las claves `catalog:*` y no puede ejecutar comandos peligrosos (`FLUSHALL`, `CONFIG`, `KEYS`) |
| Contraseñas guardadas como SHA-256 | El archivo de usuarios no tiene contraseñas en texto plano |
| Escucha solo en la IP privada y en localhost | Solo la API llega, y el firewall solo admite a `app1` y `app2` |

**Si Redis cae:** la API espera cada comando como máximo 200 ms y no encola comandos mientras Redis está caído (por defecto, el cliente los encolaría y cada request quedaría colgada). Pasa directamente a PostgreSQL y lo indica con la cabecera `X-Cache: BYPASS`. El sistema sigue funcionando; solo pierde la caché.

## 12. Configuración y secretos

| Archivo | Contenido | En git |
|---|---|---|
| `deploy/cluster.env` | IPs, versiones, puerto de la API, nombre de la base y `CURRENT_PRIMARY` | Sí: no tiene secretos |
| `deploy/secrets.env` | Contraseñas de PostgreSQL y Redis, secreto de sesiones y administrador inicial | **No** |

**Cómo se genera `secrets.env`:** con `deploy/init-secrets.sh`, en el anfitrión. Cada valor es aleatorio, de 48 caracteres hexadecimales. El formato hexadecimal es a propósito: las contraseñas van dentro de URLs de conexión, y así no hay caracteres que escapar.

**Cada servicio recibe solo lo que necesita:**

- **API:** en `/etc/ecommerce/ecommerce.env` (legible solo por root y el usuario del servicio) están el secreto de sesiones y las contraseñas de su rol en la base y en Redis.
- **Owner de la base:** su contraseña está en un archivo aparte que el servicio de la API no puede leer. Solo lo usa el despliegue para migrar.
- **Claves TLS:** se generan dentro de `edge` y nunca salen de ahí.

**Límite conocido:** con Vagrant, la carpeta del repositorio, incluido `secrets.env`, está montada en `/vagrant` en todas las VMs. Un usuario con acceso a una VM podría leer todos los secretos. En una instalación sin Vagrant se copiaría a cada VM solo lo de su rol.

## 13. Despliegues sin cortes

### Primera instalación

`vagrant up` deja el sistema completo: base de datos con sus roles, réplica, Redis, las dos instancias de la API (con las tablas creadas y el administrador inicial), la interfaz web y NGINX con su certificado.

### Publicar una versión nueva: `deploy/release.sh`

1. **En `app1`:** copia el código, compila, **migra la base** (aplica los cambios de esquema pendientes), compila la interfaz web, reinicia la instancia y espera a que responda.
2. **En `app2`:** lo mismo, sin migrar.
3. **En `edge`:** publica la interfaz web nueva y recarga NGINX, sin cortar conexiones.

**Por qué así:**

| Decisión | Por qué |
|---|---|
| Una instancia por vez | Mientras una se reinicia, la otra atiende. NGINX deja de enviarle tráfico a la que está caída, así que el usuario no nota el despliegue |
| Si una instancia no queda sana, el despliegue se detiene | La otra sigue atendiendo con la versión anterior |
| Las migraciones se ejecutan una sola vez, desde `app1` | Si cada instancia migrara al arrancar, las dos competirían por aplicar los mismos cambios. La réplica los recibe por replicación |
| Cada migración debe ser compatible con la versión anterior | Durante unos segundos conviven la versión vieja (en `app2`) y la nueva (en `app1`) sobre el mismo esquema. Primero se agrega lo nuevo, y lo que sobra se elimina en un despliegue posterior |
| La unidad de systemd se reinstala en cada publicación | Un cambio en su configuración llega con el despliegue, sin pasos manuales |

`bash deploy/demo.sh watch`, en otra terminal, envía requests continuas durante el despliegue y muestra que ninguna falla.

## 14. Cómo se observa el sistema

| Pregunta | Dónde mirar |
|---|---|
| ¿Qué instancia atendió cada request? | Log de acceso de NGINX (`/var/log/nginx/ecommerce.access.log`, campo `upstream=`) o la respuesta de `/api/v1/health` |
| ¿Qué pasó con una request concreta? | Su `X-Request-ID` aparece en la respuesta, en el log de NGINX (`rid=`) y en el log de la API que la atendió |
| ¿Está viva una instancia? ¿Cuántas veces la reinició systemd? | `systemctl status ecommerce-api@3000` · `systemctl show -p NRestarts ecommerce-api@3000` |
| ¿Qué dependencias le fallan a la API? | `GET /api/v1/health`: `database` y `cache` |
| ¿La réplica está al día? | `deploy/db/db-node.sh status` en cualquiera de los nodos de datos |
| ¿Una respuesta salió de la caché? | Cabecera `X-Cache` (catálogo) o `X-Cache-Status` (imágenes) |

Los comandos exactos están en [guia-tecnica.md §11](guia-tecnica.md#11-operación-diaria). Qué ocurre ante cada tipo de falla, cómo se detecta y cómo se recupera está en la tabla de [infraestructura.md §10](infraestructura.md#10-modos-de-fallo); cada caso se demuestra con `deploy/demo.sh` ([guía §8](guia-tecnica.md#8-demostraciones-con-deploydemosh)).

## 15. Límites y cómo crecería

Los límites de esta infraestructura y cómo se resolverían:

| Límite | Cómo se resolvería |
|---|---|
| `edge` es el único punto de entrada: si cae, el sitio queda inaccesible | Dos NGINX que comparten una IP virtual con keepalived |
| El failover es manual | Patroni + etcd, con al menos tres nodos |
| La réplica no protege de un error humano: un borrado equivocado se replica en milisegundos | Respaldos periódicos (`pg_dump` o archivado del WAL) |
| Todas las conexiones van al primario: con 10 por instancia y un máximo de 100, el techo es de unas 8 instancias | PgBouncer delante de PostgreSQL; réplicas de lectura |
| La CA local hay que importarla en cada equipo | Un dominio público con Let's Encrypt |

La lista completa de límites está en [decisiones-de-diseno.md §12](decisiones-de-diseno.md#12-límites-conocidos).
