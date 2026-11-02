/*
 * Avisos push de la app de recibos.
 * La app escribe un documento en "avisos" y esta función lo envía por FCM:
 *   - para: "profesora" → a todos los dispositivos de users/{owner}/push/{token}
 *   - para: "alumnos"   → a los dispositivos guardados en pushAlumnos/{códigoDelEnlace}
 * Después borra el aviso y limpia los dispositivos que ya no existen.
 */
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({region: "europe-southwest1", maxInstances: 3});

const APP = "https://juannhm02.github.io/recibos-clases/";
const MALOS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

exports.enviarAviso = onDocumentCreated("avisos/{id}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const a = snap.data();
  const db = admin.firestore();
  const destinos = [];

  if (a.para === "profesora" && a.owner) {
    const col = db.collection("users").doc(a.owner).collection("push");
    const s = await col.get();
    destinos.push({
      tokens: s.docs.map((d) => d.id),
      link: APP,
      quitar: (t) => col.doc(t).delete(),
    });
  } else if (a.para === "alumnos" && Array.isArray(a.alumnos)) {
    for (const codigo of a.alumnos.slice(0, 60)) {
      const ref = db.collection("pushAlumnos").doc(String(codigo));
      const d = await ref.get();
      const tokens = (d.exists && Array.isArray(d.data().tokens)) ? d.data().tokens : [];
      destinos.push({
        tokens,
        link: APP + "?h=" + encodeURIComponent(codigo),
        quitar: (t) => ref.update({tokens: admin.firestore.FieldValue.arrayRemove(t)}),
      });
    }
  }

  for (const d of destinos) {
    if (!d.tokens.length) continue;
    const r = await admin.messaging().sendEachForMulticast({
      tokens: d.tokens.slice(0, 500),
      notification: {title: String(a.titulo || "Aviso").slice(0, 90), body: String(a.cuerpo || "").slice(0, 280)},
      webpush: {
        fcmOptions: {link: d.link},
        notification: {icon: APP + "icon-192.png", badge: APP + "icon-192.png", lang: "es"},
      },
    });
    await Promise.all(r.responses.map((x, i) =>
      (!x.success && x.error && MALOS.has(x.error.code)) ? d.quitar(d.tokens[i]).catch(() => {}) : null));
  }
  await snap.ref.delete();
});
