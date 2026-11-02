# Oficina NUCLEA

El tablero de productos y la oficina en pixel art donde trabajan tres personajes originales: el Detective (investigación, de Santiago), el Hada (taller de producto, de Nicole) y la Columnista (guiones, de Anyela).

- Cada producto es una tarjeta que pasa por tres turnos: Investigación, Producto y Guiones.
- Quien toma un turno abre su agente (Claude in Chrome o el Proyecto de Claude), pega el expediente anterior y, al terminar, pega el expediente nuevo y lo entrega.
- La oficina tiene una oficina por departamento, un pasillo, la sala de juntas y el café. Cuando nadie tomó el turno de un agente, su avatar descansa en el café. Cuando alguien lo toma, camina a su oficina. Si los tres están trabajando al mismo tiempo, se reúnen en la sala de juntas. Si hay productos esperando, lo dicen en un globo y se ven papeles con un número rojo en su escritorio.
- Para verla con datos de ejemplo, sin iniciar sesión, abre la dirección con `?demo=1` al final.

## Instalación (una sola vez)

1. **Reglas de seguridad.** En Firebase (proyecto `agents-730ec`), entra a Firestore Database → **Reglas**. Borra lo que hay, pega el contenido de `firestore.rules` y pulsa **Publicar**.
2. **Publicar en Netlify.** Entra a https://app.netlify.com/drop y arrastra `oficina-nuclea.zip`. Netlify te da una dirección, por ejemplo `oficina-nuclea.netlify.app`. Puedes cambiar el nombre en la configuración del sitio.
3. **Autorizar esa dirección en Firebase.** Ve a Authentication → Configuración → **Dominios autorizados** → Agregar dominio, y pega la dirección de Netlify sin `https://`.
4. **Entrar.** Abre la dirección y entra con la cuenta `nucleagent@gmail.com`. En **Equipo**, agrega el correo de Google y el nombre de cada persona.

## Chat con los agentes

Al tocar a un agente se abre su chat a la derecha. Se elige el producto, se le escribe y responde en tiempo real con Claude (modelo Opus 5.5), a través del servidor del chat en Cloudflare. Todo el equipo ve la conversación en vivo y el avatar muestra "Escribiendo…" en su oficina.

- El agente ya conoce el producto y los expedientes de los agentes anteriores.
- Cuando el Hada entrega archivos, aparecen botones para descargar la app para Netlify (.zip, con los íconos PNG generados) y los bonos.
- Cuando el agente cierra con su expediente, aparece el botón **Entregar** que pasa el producto al siguiente agente.
- El Detective no navega por internet: la búsqueda se hace con Claude in Chrome y se pega en su chat.
- En **Conocimiento** (solo administradores) se pega o se sube el material de referencia de cada agente, por ejemplo el `index.html` de un reto anterior para el Hada.

### Activar el chat (una sola vez)

El chat usa un servidor pequeño en Cloudflare (gratis, sin tarjeta) que guarda la clave de Claude. Firebase sigue en el plan gratuito.

1. **Clave de Claude.** En https://platform.claude.com crea la cuenta, carga créditos (desde 5 USD) y crea una API key. En la configuración de la organización, en **Limits**, pon un límite de gasto mensual. Es aparte de la suscripción de claude.ai y se cobra por uso.
2. **Servidor en Cloudflare.** Crea una cuenta gratis en https://dash.cloudflare.com/sign-up. En **Workers & Pages** → **Create** → **Start with Hello World**, ponle de nombre `oficina-nuclea-chat` y pulsa **Deploy**. Luego **Edit code**: borra todo, pega el contenido completo de `chat-worker.js` y pulsa **Deploy**.
3. **Guardar la clave.** En ese Worker → **Settings** → **Variables and Secrets** → **Add**. Tipo **Secret**, nombre `ANTHROPIC_API_KEY`, valor: la API key del paso 1. Guarda y despliega.
4. **Dirección del servidor.** Copia la dirección del Worker (termina en `.workers.dev`) y escríbela en `config.js`, en `CHAT_URL`, agregando `/chat` al final. Esta dirección no es secreta.
5. **Reglas.** Pega `firestore.rules` en Firebase → Firestore Database → Reglas → **Publicar** (cambiaron para el chat).
6. **Publicar la oficina.** Sube el `.zip` nuevo de la oficina a Netlify, en **Deploys**.

La clave de Claude solo se guarda en Cloudflare; nunca en el chat ni en el código. El código del servidor está en `servidor/` (con `npm run construir` se vuelve a generar `chat-worker.js` cuando cambian las instrucciones de los agentes).

## Cambiar nombres, enlaces o colores

Todo está en `config.js`: los nombres, la persona a cargo, las frases y los colores de los avatares, el enlace de la Biblioteca de anuncios del Detective, los países y los administradores. Si cambias los administradores, cámbialos también en `firestore.rules` y en `functions/index.js`.

Para publicar un cambio, vuelve a comprimir los archivos (sin `firestore.rules` ni este README) y arrástralos al mismo sitio de Netlify, en **Deploys**.
