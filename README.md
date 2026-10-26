# Agentes de NUCLEA

## Agente de Caja

Llena solo la caja (`caja-pdfs` en Firebase) con las ventas de Leona y el gasto de Meta, sin cambiar la app.

Cómo funciona:

1. **Cada venta** que registra Leona llega por webhook a la función `leonaWebhook` y queda guardada en `agente_leona_eventos`.
2. **Todos los días a las 6:00 a. m. (hora Colombia)**, la función `cierreDiario` toma el día anterior:
   - suma las ventas de Leona por producto,
   - trae el gasto de Meta por campaña,
   - cruza ambos con el catálogo de la caja usando el nombre del producto,
   - guarda en `movimientos` lo mismo que el botón "Guardar el día", con la nota "Cargado por el agente".
3. **Si una persona ya guardó ese día** a mano, el agente no lo pisa: lo anota como "respetado".
4. Deja un reporte en `agente_reportes/caja-AAAA-MM-DD` con los totales, el ROAS y lo que no pudo asignar a un producto. La oficina virtual leerá estos reportes.

Las ventas o campañas cuyo nombre no coincide con ningún producto quedan en "General / sin producto" y aparecen en el reporte, para corregir el nombre.

## Instalación (una sola vez)

No hace falta programar. Son pasos de configuración en Firebase, Meta y GitHub.

1. **Firebase, plan Blaze.** En la consola de Firebase del proyecto `caja-pdfs`, cambia al plan Blaze (pago por uso). Las tareas programadas lo necesitan. Con este volumen el costo debería ser mínimo.
2. **Clave de servicio para GitHub.** En Google Cloud, en IAM, Cuentas de servicio, crea una cuenta "desplegador" con los roles Editor, Administrador de Cloud Functions, Administrador de Secret Manager y Usuario de cuenta de servicio. Descarga su clave JSON.
3. **Token de Meta.** En Meta Business, en Configuración del negocio, Usuarios del sistema, crea un usuario del sistema, dale acceso a la cuenta publicitaria y genera un token con el permiso `ads_read`. Anota también el ID de la cuenta publicitaria.
4. **Secretos en GitHub.** En este repositorio, en Settings, Secrets and variables, Actions, crea estos secretos:
   - `FIREBASE_SERVICE_ACCOUNT`: el contenido completo del JSON del paso 2
   - `META_TOKEN`: el token del paso 3
   - `META_CUENTA`: el ID de la cuenta publicitaria (con o sin `act_`)
   - `LEONA_WEBHOOK_CLAVE`: una contraseña larga inventada, que protege el webhook
5. **Desplegar.** En la pestaña Actions, abre "Desplegar agente de caja" y pulsa "Run workflow".
6. **Conectar Leona.** En Leona, configura el webhook de ventas con esta dirección:
   `https://us-central1-caja-pdfs.cloudfunctions.net/leonaWebhook?clave=TU_LEONA_WEBHOOK_CLAVE`

Las claves nunca se pegan en el chat ni en el código; solo en los secretos de GitHub.

## Probar un día a mano

`https://us-central1-caja-pdfs.cloudfunctions.net/cerrarDiaManual?fecha=2026-10-25&clave=TU_LEONA_WEBHOOK_CLAVE`

Responde con el reporte del día.

## Pendiente

- Todavía no hemos visto un webhook real de Leona. `functions/src/leona.js` reconoce los nombres de campo más comunes. Con la primera venta real, que queda guardada completa en `agente_leona_eventos`, se ajusta.
- El resumen diario por WhatsApp. Por ahora el resumen queda en `agente_reportes`.

## Desarrollo

```
cd functions && npm install && npm test
```
