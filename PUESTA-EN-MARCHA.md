# Puesta en marcha de los avisos push

Los avisos se envían con un pequeño programa gratuito en **Cloudflare Workers** que, cada minuto, mira si hay avisos nuevos en Firebase y los manda. Firebase se queda en el plan gratuito (Spark): no hace falta Blaze ni tarjeta.

Los avisos pueden tardar hasta un minuto en llegar.

## 1. Sacar la clave de la cuenta de servicio de Firebase

1. Abre <https://console.firebase.google.com/project/recibos-clases/settings/serviceaccounts/adminsdk>.
2. Pulsa **Generar nueva clave privada** › **Generar clave**. Se descarga un archivo `.json`.
3. Ábrelo con un editor de texto (en Mac, TextEdit) y copia **todo** el contenido, desde la primera `{` hasta la última `}`.

Esa clave da acceso total a la base de datos. No la subas a GitHub ni se la mandes a nadie. Cuando la hayas pegado en Cloudflare, borra el archivo.

## 2. Crear el worker en Cloudflare

1. Crea una cuenta gratuita en <https://dash.cloudflare.com/sign-up> (no pide tarjeta).
2. En el menú, entra en **Workers y Pages** (Compute › Workers) › **Crear** › **Empezar con "Hola mundo"**.
3. Ponle de nombre `recibos-avisos` y pulsa **Implementar** (Deploy).
4. Pulsa **Editar código**. Borra todo lo que hay y pega el contenido de
   <https://raw.githubusercontent.com/juannhm02/recibos-clases/main/cloudflare/worker.js>.
   Pulsa **Implementar**.

## 3. Pegar la clave

1. En el worker, ve a **Configuración** › **Variables y secretos** › **Añadir**.
2. Tipo: **Secreto**. Nombre: `SA`. Valor: pega el JSON entero del paso 1.
3. Pulsa **Implementar**.

## 4. Hacer que se ejecute cada minuto

1. En **Configuración** › **Activadores** (Trigger events) › **Añadir** › **Activadores cron**.
2. Elige **Cada minuto** o escribe `* * * * *`.
3. Guarda.

## 5. Comprobar

Abre la dirección del worker (algo como `https://recibos-avisos.TU-NOMBRE.workers.dev`). Debe decir:

> Avisos de recibos-clases: configurado para el proyecto recibos-clases.

Si dice que falta el secreto, repite el paso 3.

## 6. Activar los avisos en los móviles

- **Tu madre:** en la app, **Ajustes › Avisos en este móvil › Activar avisos**, y aceptar el permiso.
- **Cada niño:** en su enlace, **Activar avisos**, al final de la página.
- **En iPhone:** primero hay que añadir la página a la pantalla de inicio (Safari › Compartir › Añadir a pantalla de inicio) y abrirla desde ese icono. Si no, iOS no permite los avisos.

Para ver si algo falla: en el worker, pestaña **Registros** (Logs) o **Observabilidad**.
