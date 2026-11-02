# Versión 3: puesta en marcha

Hazlo en este orden. Las reglas nuevas tienen que estar publicadas antes que la app nueva: si no, las peticiones de los niños fallan.

## 1. Copiar los archivos

Descomprime el zip encima de `Documents\2.PROYECTOS\recibos-clases` y deja que sustituya los archivos.

## 2. Pasar Firebase al plan Blaze

1. En <https://console.firebase.google.com/project/recibos-clases/usage/details>, pulsa **Modificar plan › Blaze** y añade la tarjeta.
2. Recomendado: en Google Cloud › Facturación › **Presupuestos y alertas**, crea un presupuesto de 1 € con aviso por correo. Con este uso el gasto es de 0 €, pero así te enteras si algo raro pasa.

## 3. Generar la clave de los avisos

1. Ve a **Configuración del proyecto** (rueda dentada) › **Cloud Messaging** › **Certificados push web** › **Generar par de claves**.
2. Copia la clave que aparece. Es larga y empieza por `B…`.
3. (Ya hecho: la clave está puesta en `index.html`.)

## 4. Publicar las reglas y el servidor de avisos

Abre una terminal en la carpeta del proyecto. Necesitas tener instalado Node.js 22 o superior.

```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions
```

- Si pregunta por la política de limpieza de imágenes («cleanup policy»), responde que sí con 1 día.
- La primera vez tarda unos minutos porque activa varios servicios de Google Cloud.

## 5. Subir la app

```bash
git add .
git commit -m "Versión 3: peticiones, avisos push y horario nuevo"
git push
```

GitHub Pages la publica en un par de minutos.

## 6. Activar los avisos

- **Tu madre:** en la app, **Ajustes › Avisos en este móvil › Activar avisos**, y aceptar el permiso.
- **Cada niño:** en su enlace, **Activar avisos**, al final de la página.
- **En iPhone:** primero hay que añadir la página a la pantalla de inicio (Safari › Compartir › Añadir a pantalla de inicio) y abrirla desde ese icono. Si no, iOS no permite los avisos.
