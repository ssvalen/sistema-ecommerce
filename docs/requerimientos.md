# Requerimientos del sistema

sistema-e es una tienda en línea (e-commerce): catálogo, carrito, pedidos con pago simulado, reseñas y administración de productos, inventario y usuarios.

Este documento define qué debe hacer el sistema (requisitos funcionales) y con qué características técnicas (requisitos técnicos). La relación entre cada requisito, su implementación y la forma de verificarlo está en [trazabilidad.md](trazabilidad.md).

## 1. Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | API REST en Node.js con TypeScript |
| Interfaz web | React con TypeScript y Tailwind CSS |
| Base de datos | PostgreSQL, con un modelo relacional |
| Caché | Redis, para las consultas de acceso frecuente que lo justifiquen |
| Entrada y balanceo | NGINX |
| Servicios | Servicios nativos de Linux administrados con systemd |

## 2. Usuarios y autenticación

El sistema tiene dos tipos de usuario: **Cliente** y **Administrador**.

**El cliente puede:**

- registrarse e iniciar sesión;
- consultar, buscar y filtrar productos;
- agregar productos al carrito y modificarlo;
- crear pedidos y realizar un pago simulado;
- consultar su historial de pedidos;
- reseñar los productos que compró.

**El administrador puede:**

- iniciar sesión;
- crear, editar y eliminar productos;
- gestionar categorías e inventario;
- consultar usuarios y sus detalles, incluido el historial de pedidos de cada cliente;
- bloquear y desbloquear usuarios;
- eliminar reseñas.

**Requisitos de seguridad de las cuentas:**

- **Contraseñas:** se almacenan con un mecanismo de hashing seguro.
- **Sesión:** se mantiene en una cookie `HttpOnly`. El sistema permite cerrarla (`logout`) y consultar quién es el usuario de la sesión actual.
- **Cuenta bloqueada:** no puede iniciar sesión ni usar las funcionalidades protegidas. El bloqueo tiene efecto inmediato.

## 3. Productos

**Datos de cada producto:** nombre, descripción, precio, imagen, categoría, stock y la información necesaria para determinar sus unidades vendidas.

- **Imagen:** puede ser una URL externa o un archivo subido.
- **Gestión:** el administrador crea, edita y elimina productos.
- **Catálogo:** los clientes pueden:
  - consultarlo;
  - buscar productos;
  - filtrar por categoría y por precio;
  - ordenar por popularidad, que se determina por las unidades vendidas;
  - recorrerlo con paginación.

## 4. Carrito

El carrito permite agregar productos, modificar cantidades, eliminar productos y consultar su contenido, con las cantidades, los subtotales y el total.

La cantidad solicitada se valida contra el inventario disponible.

## 5. Pedidos y pago

**Flujo de compra:**

1. revisar el carrito;
2. validar la disponibilidad de los productos;
3. crear el pedido con su detalle;
4. ejecutar un pago simulado;
5. completar el pedido y descontar el inventario.

El pedido queda disponible después en el historial del cliente.

**Garantías:**

- Las operaciones sobre el pedido, su detalle y el inventario usan transacciones.
- Si una operación crítica falla, la transacción se revierte, para que pedido, detalle e inventario nunca queden inconsistentes.

## 6. Inventario

Cada producto tiene stock. El sistema:

- muestra la disponibilidad;
- valida que exista stock antes de completar un pedido;
- impide vender una cantidad superior al stock disponible;
- descuenta el inventario al completar correctamente un pedido;
- permite al administrador ajustar el stock.

## 7. Gestión de usuarios

El administrador puede:

- listar usuarios;
- consultar la información de un usuario y su historial de pedidos;
- bloquear y desbloquear cuentas.

El sistema aplica las restricciones de acceso según el estado de la cuenta.

## 8. Reseñas

- **Quién reseña:** un cliente puede calificar de 1 a 5 estrellas, con un comentario opcional, un producto que compró. Tiene una reseña por producto, que puede reemplazar o eliminar.
- **Visibilidad:** el catálogo muestra la calificación promedio de cada producto y sus reseñas.
- **Moderación:** el administrador puede eliminar cualquier reseña.

## 9. Base de datos y lógica de negocio

La base de datos es un modelo relacional normalizado, con:

- llaves primarias y foráneas;
- constraints e integridad referencial;
- índices en las consultas frecuentes;
- relaciones bien definidas y manejo consistente de estados.

**Reglas sobre la lógica:**

- Las operaciones críticas usan transacciones.
- Los triggers se usan solo cuando aportan una ventaja clara y justificada.
- La lógica de negocio vive en el backend, sin duplicarse entre capas.

**Datos de demostración:** un script carga volumen para demostrar el catálogo y verificar el uso de los índices.

## 10. API REST

El backend expone una API REST organizada, con endpoints para autenticación, usuarios, productos, categorías, carrito, pedidos, inventario y reseñas.

**Los endpoints implementan:**

- validación de entrada;
- autorización según el tipo de usuario;
- manejo adecuado de errores;
- códigos HTTP apropiados;
- respuestas consistentes.

La API se documenta con Swagger/OpenAPI.

## 11. Seguridad

Medidas proporcionales al sistema:

- hash seguro de contraseñas;
- autenticación y autorización;
- validación de entradas;
- protección de los endpoints administrativos;
- manejo seguro de credenciales y secretos;
- HTTPS;
- no exponer información sensible.

## 12. Interfaz web

- **Despliegue:** la sirve NGINX, desde el mismo origen que la API.
- **Seguridad:** aplica las medidas propias del navegador: política de seguridad de contenido, sin scripts inline y sin exponer el código fuente.
- **Organización:** en módulos por contexto de negocio, con los mismos nombres que el backend.
- **Lógica:** no duplica la lógica de negocio; muestra lo que calcula el backend.

## 13. Infraestructura y despliegue

```
Cliente → NGINX → Backend 1 / Backend 2 → PostgreSQL (primario → réplica)
                                       → Redis
```

- **Entrada:** NGINX es el punto de entrada, termina HTTPS y distribuye las solicitudes entre las dos instancias del backend.
- **Backend:** cada instancia es un servicio independiente administrado por systemd, con reinicio automático. Lo mismo vale para NGINX, PostgreSQL y Redis.
- **Base de datos:** PostgreSQL tiene un primario y una réplica en espera, con un procedimiento de failover para promover la réplica si se pierde el primario.
- **Despliegue repetible:** se hace con scripts de instalación y configuración, sobre cinco máquinas virtuales (`edge`, `app1`, `app2`, `data1`, `data2`) creadas con Vagrant.
- **Demostraciones:** debe ser posible demostrar que:
  - NGINX distribuye las solicitudes entre las dos instancias;
  - el sistema sigue atendiendo si una instancia deja de responder.

## 14. Documentación

- descripción general de la solución;
- arquitectura de software, con su diagrama;
- diagrama de infraestructura;
- modelo de base de datos;
- instrucciones de instalación y de ejecución;
- configuración de NGINX, systemd, PostgreSQL y Redis;
- documentación de la API con Swagger/OpenAPI.

## 15. Criterios técnicos generales

- separación de responsabilidades y código organizado y mantenible;
- validaciones y manejo adecuado de errores;
- integridad de datos y transacciones;
- consultas eficientes, paginación e índices;
- seguridad básica;
- configuración mediante variables de entorno.
