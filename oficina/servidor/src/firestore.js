// Lectura de Firestore por REST con el token de quien escribe: Firebase aplica las
// reglas de seguridad, así que si la persona no es del equipo, no puede leer nada.
function valor(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) return campos(v.mapValue.fields);
  return null;
}
export const campos = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, valor(v)]));

export class ErrorFirestore extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

export function crearFirestore({ proyecto, token, base = "https://firestore.googleapis.com/v1" }) {
  const raiz = `${base}/projects/${proyecto}/databases/(default)/documents`;
  async function pedir(ruta, opcional = false) {
    const r = await fetch(`${raiz}/${ruta}`, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 404 && opcional) return null;
    if (r.status === 401) throw new ErrorFirestore(401, "Inicia sesión de nuevo");
    if (r.status === 403) throw new ErrorFirestore(403, "No eres parte del equipo");
    if (r.status === 404) throw new ErrorFirestore(404, "No existe el producto");
    if (!r.ok) throw new ErrorFirestore(502, "Firebase no respondió (" + r.status + ")");
    return r.json();
  }
  return {
    async documento(ruta, opcional) {
      const d = await pedir(ruta, opcional);
      return d ? campos(d.fields) : null;
    },
    async lista(ruta) {
      const docs = [];
      let pagina = "";
      do {
        const d = await pedir(`${ruta}?pageSize=300&orderBy=creadoEn${pagina ? "&pageToken=" + encodeURIComponent(pagina) : ""}`);
        (d.documents || []).forEach((x) => docs.push({ id: x.name.split("/").pop(), ...campos(x.fields) }));
        pagina = d.nextPageToken;
      } while (pagina && docs.length < 3000);
      return docs;
    },
  };
}
