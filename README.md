# Recibos de Clases

App para gestionar los recibos mensuales y el horario de las clases particulares.

- **App:** <https://juannhm02.github.io/recibos-clases/>
- **Firebase:** proyecto `recibos-clases` (<https://console.firebase.google.com/project/recibos-clases>)
- **Base de datos:** Cloud Firestore en `europe-southwest1` (Madrid), plan gratis Spark.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app entera: la de la profesora y la página que ve cada alumno (`?h=código`). |
| `firestore.rules` | Reglas de seguridad de la base de datos. |
| `firebase.json` | Por si algún día se publica con Firebase Hosting en vez de GitHub Pages. |

## Cómo hacer cambios

1. Edita `index.html` (o pídeselo a Claude).
2. Haz commit y push a `main`:
   ```bash
   git add .
   git commit -m "Lo que hayas cambiado"
   git push
   ```
3. GitHub Pages lo publica solo en un minuto o dos.

Si cambias `firestore.rules`, publícalas también en la consola: **Firestore › Reglas › Publicar**. Otra opción es `firebase deploy --only firestore:rules`.

## Usuarios

- Solo puede entrar el usuario creado en **Authentication › Usuarios** (el registro libre está desactivado).
- Para añadir o cambiar la cuenta de tu madre: **Authentication › Usuarios › Agregar usuario**.
- Si se olvida la contraseña, la pantalla de acceso tiene «He olvidado la contraseña».

## Seguridad (resumen de las reglas)

- `users/{uid}/…`: alumnos, meses, pagos y configuración. Solo los lee y escribe ese usuario.
- `horarios/{código}`: el horario público de cada alumno. Se lee solo con el código del enlace, no se puede listar y solo lo escribe la profesora.
- `solicitudes/{id}`: peticiones de clase. Un alumno con enlace válido solo puede crear una pendiente para sí mismo. Responderlas solo puede la profesora.
- El dominio `juannhm02.github.io` está autorizado en **Authentication › Configuración › Dominios autorizados**. Si la app se mueve a otra dirección, hay que añadir el nuevo dominio ahí.

## Cómo funciona para los alumnos

- Cada alumno tiene un enlace fijo (`…/recibos-clases/?h=código`) que se copia desde su ficha.
- Con él ve su próxima clase, sus clases del mes actual y del siguiente, y puede **pedir una clase**.
- **Cambiar enlace** invalida el anterior. Si el alumno se da de baja, su enlace deja de funcionar.
- Las peticiones respondidas se borran solas a los dos meses.

## Sin conexión

La app guarda una copia local. Sin internet se puede seguir apuntando y los cambios se suben al volver la conexión. **Descargar PDF** necesita internet; sin él, **Imprimir › Guardar como PDF**.
