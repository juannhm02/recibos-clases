/*
 * Avisos push de la app de recibos (gratis, en Cloudflare Workers).
 *
 * Cada minuto mira la colección "avisos" de Firestore y envía cada aviso por FCM:
 *   - para: "profesora" → a los dispositivos de users/{owner}/push/{token}
 *   - para: "alumnos"   → a los dispositivos de pushAlumnos/{códigoDelEnlace}
 * Después borra el aviso y limpia los dispositivos que ya no existen.
 *
 * Necesita un secreto llamado SA con el JSON entero de la cuenta de servicio de Firebase
 * (Configuración del proyecto › Cuentas de servicio › Generar nueva clave privada)
 * y un activador cron "* * * * *".
 */

const APP = "https://juannhm02.github.io/recibos-clases/";
const ICONO = APP + "icon-192.png";
const LIMITE = 45; // el plan gratuito permite 50 peticiones salientes por ejecución

let cache = null; // {token, exp, proyecto}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(procesar(env).catch((e) => console.error("avisos:", e && e.stack || e)));
  },
  async fetch(req, env) {
    // Solo informativo: abrir la URL del worker en el navegador muestra si está bien configurado.
    try {
      const sa = leerSA(env);
      return new Response("Avisos de recibos-clases: configurado para el proyecto " + sa.project_id + ".\n", {headers: {"content-type": "text/plain; charset=utf-8"}});
    } catch (e) {
      return new Response("Falta el secreto SA o no es válido: " + e.message + "\n", {status: 500, headers: {"content-type": "text/plain; charset=utf-8"}});
    }
  },
};

/* ---------------- lógica ---------------- */

async function procesar(env, f = fetch) {
  const sa = leerSA(env);
  const ctx = {f: (u, o) => f(u, o), usadas: 0, sa}; // fetch no puede llamarse como método de otro objeto en Workers
  const token = await tokenAcceso(ctx);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const nombreBase = `projects/${sa.project_id}/databases/(default)/documents`;
  const H = {authorization: "Bearer " + token, "content-type": "application/json"};
  ctx.H = H;

  const lista = await pedir(ctx, `${base}/avisos?pageSize=20`, {headers: H});
  const docs = (lista && lista.documents) || [];
  if (!docs.length) return {enviados: 0};

  const escrituras = []; // limpieza y restos, en un solo commit al final
  let enviados = 0;

  for (const doc of docs) {
    if (LIMITE - ctx.usadas < 4) break; // lo que quede, en el siguiente minuto
    const a = desFirestore(doc.fields || {});

    // Reclamar el aviso borrándolo (si otra ejecución ya lo cogió, el borrado falla y lo saltamos).
    const borrado = await pedir(ctx, `https://firestore.googleapis.com/v1/${doc.name}?currentDocument.exists=true`, {method: "DELETE", headers: H}, true);
    if (!borrado.ok) continue;

    const titulo = String(a.titulo || "Aviso").slice(0, 90);
    const cuerpo = String(a.cuerpo || "").slice(0, 280);
    let grupos = []; // [{codigo?, link, tokens, quitar(t)}]

    if (a.para === "profesora" && a.owner) {
      const r = await pedir(ctx, `${base}/users/${encodeURIComponent(a.owner)}/push?pageSize=50`, {headers: H});
      const toks = ((r && r.documents) || []).map((d) => d.name.split("/").pop());
      grupos.push({link: APP, tokens: toks, quitar: (t) => ({delete: `${nombreBase}/users/${a.owner}/push/${t}`})});
    } else if (a.para === "alumnos" && Array.isArray(a.alumnos) && a.alumnos.length) {
      const codigos = a.alumnos.slice(0, 60).map(String);
      const r = await pedir(ctx, `${base}:batchGet`, {method: "POST", headers: H, body: JSON.stringify({documents: codigos.map((c) => `${nombreBase}/pushAlumnos/${c}`)})});
      const porCodigo = {};
      for (const x of (Array.isArray(r) ? r : [])) {
        if (x.found) {
          const d = desFirestore(x.found.fields || {});
          porCodigo[x.found.name.split("/").pop()] = Array.isArray(d.tokens) ? d.tokens.map(String) : [];
        }
      }
      grupos = codigos.map((c) => ({
        codigo: c,
        link: APP + "?h=" + encodeURIComponent(c),
        tokens: porCodigo[c] || [],
        quitar: (t) => ({transform: {document: `${nombreBase}/pushAlumnos/${c}`, fieldTransforms: [{fieldPath: "tokens", removeAllFromArray: {values: [{stringValue: t}]}}]}}),
      }));
    }

    const pendientes = [];
    for (const g of grupos) {
      if (!g.tokens.length) continue;
      // Si este grupo no cabe en lo que queda de esta ejecución, se deja para la siguiente.
      if (pendientes.length || ctx.usadas + g.tokens.length > LIMITE - 1) {
        if (g.codigo) { pendientes.push(g.codigo); continue; }
      }
      for (const t of g.tokens) {
        if (ctx.usadas >= LIMITE - 1) break;
        const res = await enviar(ctx, t, titulo, cuerpo, g.link);
        if (res === "ok") enviados++;
        else if (res === "malo") escrituras.push(g.quitar(t));
      }
    }
    if (pendientes.length) {
      const id = "resto-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      escrituras.push({
        update: {name: `${nombreBase}/avisos/${id}`, fields: aFirestore({para: "alumnos", owner: a.owner, alumnos: pendientes, titulo, cuerpo, creado: a.creado || new Date().toISOString()})},
        currentDocument: {exists: false},
      });
    }
  }

  if (escrituras.length && ctx.usadas < 50) {
    await pedir(ctx, `${base}:commit`, {method: "POST", headers: H, body: JSON.stringify({writes: escrituras})}, true);
  }
  return {enviados, peticiones: ctx.usadas};
}

async function enviar(ctx, t, titulo, cuerpo, link) {
  const r = await pedir(ctx, `https://fcm.googleapis.com/v1/projects/${ctx.sa.project_id}/messages:send`, {
    method: "POST",
    headers: ctx.H,
    body: JSON.stringify({message: {
      token: t,
      notification: {title: titulo, body: cuerpo},
      webpush: {fcmOptions: {link}, notification: {icon: ICONO, badge: ICONO, lang: "es"}},
    }}),
  }, true);
  if (r.ok) return "ok";
  const txt = r.texto || "";
  if (r.status === 404 || /UNREGISTERED|NOT_FOUND/.test(txt) || (r.status === 400 && /registration token/i.test(txt))) return "malo";
  console.error("FCM", r.status, txt.slice(0, 300));
  return "error";
}

async function pedir(ctx, url, opt, crudo) {
  ctx.usadas++;
  const r = await ctx.f(url, opt);
  if (crudo) return {ok: r.ok, status: r.status, texto: r.ok ? "" : await r.text()};
  if (!r.ok) throw new Error(`${opt && opt.method || "GET"} ${url.split("?")[0]} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/* ---------------- credenciales de Google ---------------- */

function leerSA(env) {
  if (!env || !env.SA) throw new Error("no existe");
  const sa = typeof env.SA === "string" ? JSON.parse(env.SA) : env.SA;
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error("faltan campos (¿has pegado el JSON entero?)");
  return sa;
}

async function tokenAcceso(ctx) {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.proyecto === ctx.sa.project_id && cache.exp - 120 > ahora) return cache.token;
  const cab = {alg: "RS256", typ: "JWT"};
  const datos = {
    iss: ctx.sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  };
  const entrada = b64url(JSON.stringify(cab)) + "." + b64url(JSON.stringify(datos));
  const pem = ctx.sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey("pkcs8", der, {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(entrada)));
  const jwt = entrada + "." + b64url(firma);
  const r = await pedir(ctx, "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"content-type": "application/x-www-form-urlencoded"},
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt,
  });
  cache = {token: r.access_token, exp: ahora + (r.expires_in || 3600), proyecto: ctx.sa.project_id};
  return cache.token;
}

function b64url(x) {
  const bytes = typeof x === "string" ? new TextEncoder().encode(x) : x;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------------- formato de Firestore ---------------- */

function desValor(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(desValor);
  if ("mapValue" in v) return desFirestore(v.mapValue.fields || {});
  return null;
}
function desFirestore(fields) {
  const o = {};
  for (const k of Object.keys(fields)) o[k] = desValor(fields[k]);
  return o;
}
function aValor(x) {
  if (x === null || x === undefined) return {nullValue: null};
  if (Array.isArray(x)) return {arrayValue: {values: x.map(aValor)}};
  if (typeof x === "boolean") return {booleanValue: x};
  if (typeof x === "number") return Number.isInteger(x) ? {integerValue: String(x)} : {doubleValue: x};
  if (typeof x === "object") return {mapValue: {fields: aFirestore(x)}};
  return {stringValue: String(x)};
}
function aFirestore(o) {
  const f = {};
  for (const k of Object.keys(o)) f[k] = aValor(o[k]);
  return f;
}
