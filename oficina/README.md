# Oficina NUCLEA

NUCLEA OS: la oficina de agentes del equipo. Tiene un menú lateral con los departamentos y los agentes, un mapa en pixel art donde se ve a cada agente trabajar, y un chat siempre abierto con cada uno.

- **Agentes de hoy (Fábrica de productos):** el Detective (investigación, de Santiago), el Hada (taller de producto, de Nicole) y la Columnista (guiones, de Anyela). Los personajes son originales.
- **Próximamente:** Finanzas y Contenido, con los agentes que vienen en camino. En el mapa están en una oficina "en obra".
- **El mundo:** cada agente tiene su oficina. Cuando no tiene trabajo descansa en el café; cuando hay un turno en curso o está escribiendo, camina a su escritorio; si todos trabajan a la vez, se reúnen en la sala de juntas. Al tocar a un agente se abre su tarjeta con sus pendientes y el botón **Chatear aquí**.
- **Tablero:** cada producto pasa por tres turnos (Investigación, Producto y Guiones).
- **Te toca:** lo que espera a la persona que entró (sus turnos en curso y lo que espera a sus agentes).
- Para verla con datos de ejemplo, sin iniciar sesión, abre la dirección con `?demo=1` al final.

## Instalación (una sola vez)

1. **Reglas de seguridad.** En Firebase (proyecto `agents-730ec`), entra a Firestore Database → **Reglas**. Borra lo que hay, pega el contenido de `firestore.rules` y pulsa **Publicar**.
2. **Publicar en Netlify.** Entra a https://app.netlify.com/drop y arrastra `oficina-nuclea.zip`. Netlify te da una dirección, por ejemplo `oficina-nuclea.netlify.app`. Puedes cambiar el nombre en la configuración del sitio.
3. **Autorizar esa dirección en Firebase.** Ve a Authentication → Configuración → **Dominios autorizados** → Agregar dominio, y pega la dirección de Netlify sin `https://`.
4. **Entrar.** Abre la dirección y entra con la cuenta `nucleagent@gmail.com`. En **Equipo**, agrega el correo de Google y el nombre de cada persona.

## Chat con los agentes

El chat está siempre abierto a la derecha (en pantallas pequeñas, con el botón **Chat**). Arriba se elige el agente; cada agente tiene varias conversaciones y **+ Nueva** abre otra. Responde en tiempo real con Claude (modelo Opus 5.5), a través del servidor del chat en Cloudflare. Todo el equipo ve las conversaciones en vivo.

- **Conversaciones libres:** se le puede preguntar cualquier cosa de su área, sin producto.
- **Conversaciones de un producto:** al empezar se elige "Sobre un producto". El agente conoce ese producto y los expedientes de los agentes anteriores. Cuando cierra con su expediente, aparece **Entregar** para pasar el producto al siguiente agente.
- **Información en conjunto:** en cada mensaje, todos los agentes ven el tablero completo (productos, quién los trabaja y un resumen de los expedientes) y saben qué hace cada agente. Así cada uno trabaja por su lado, pero con la información de todos.
- Cuando el Hada entrega archivos, aparecen botones para descargar la app para Netlify (.zip, con los íconos PNG generados) y los bonos.
- El Detective no navega por internet: la búsqueda se hace con Claude in Chrome y se pega en su chat.
- En **Conocimiento** (solo administradores) se pega o se sube el material de referencia de cada agente. Todo eso viaja en cada mensaje: mientras más corto, más barato.
- **Modelos y costo:** el Hada usa Claude Opus 5.5; el Detective y la Columnista, Claude Sonnet 5.5 (la mitad del precio). Se cambia en `config.js`, campo `modelo` de cada agente. Debajo de cada respuesta aparece su costo aproximado y, abajo del chat, el total de la conversación.
- **Imágenes:** en el chat del Hada se pueden subir (botón 🖼️) o pegar hasta 3 imágenes por mensaje, por ejemplo una captura del producto original o una paleta. La oficina las achica antes de guardarlas. Para activarlo en otro agente, pon `imagenes: true` en `config.js`.

### Activar el chat (una sola vez)

El chat usa un servidor pequeño en Cloudflare (gratis, sin tarjeta) que guarda la clave de Claude. Firebase sigue en el plan gratuito.

1. **Clave de Claude.** En https://platform.claude.com crea la cuenta, carga créditos (desde 5 USD) y crea una API key. En la configuración de la organización, en **Limits**, pon un límite de gasto mensual. Es aparte de la suscripción de claude.ai y se cobra por uso.
2. **Servidor en Cloudflare.** Crea una cuenta gratis en https://dash.cloudflare.com/sign-up. En **Workers & Pages** → **Create** → **Start with Hello World**, ponle de nombre `oficina-nuclea-chat` y pulsa **Deploy**. Luego **Edit code**: borra todo, pega el contenido completo de `chat-worker.js` y pulsa **Deploy**.
3. **Guardar la clave.** En ese Worker → **Settings** → **Variables and Secrets** → **Add**. Tipo **Secret**, nombre `ANTHROPIC_API_KEY`, valor: la API key del paso 1. Guarda y despliega.
4. **Dirección del servidor.** Copia la dirección del Worker (termina en `.workers.dev`) y escríbela en `config.js`, en `CHAT_URL`, agregando `/chat` al final. Esta dirección no es secreta.
5. **Reglas.** Pega `firestore.rules` en Firebase → Firestore Database → Reglas → **Publicar** (cambiaron para el chat).
6. **Publicar la oficina.** Sube el `.zip` nuevo de la oficina a Netlify, en **Deploys**.

La clave de Claude solo se guarda en Cloudflare; nunca en el chat ni en el código. El código del servidor está en `servidor/` (con `npm run construir` se vuelve a generar `chat-worker.js` cuando cambian las instrucciones de los agentes).

## Actualizar a una versión nueva

Cuando cambie la oficina, son tres pasos, en este orden:

1. **Servidor:** en Cloudflare → el Worker `oficina-nuclea-chat` → **Edit code**, borra todo, pega el `chat-worker.js` nuevo y pulsa **Deploy**. La clave guardada no se toca.
2. **Reglas:** pega `firestore.rules` en Firebase → Firestore Database → Reglas → **Publicar**.
3. **Oficina:** en Netlify → el sitio → **Deploys**, arrastra el `oficina-nuclea.zip` nuevo.

## Sumar un agente o un departamento

Todo se define en `config.js`:

- `DEPARTAMENTOS`: nombre y color de cada departamento.
- `AGENTES`: cada agente con su departamento, nombre, persona a cargo, descripción, preguntas sugeridas, colores y `instrucciones` (el archivo `.md` de la carpeta `agentes/`). El mapa le arma su oficina y el menú, su fila y su chat. Si su `estilo` no es uno de los existentes, usa una oficina y un personaje genéricos con sus colores.
- `PROXIMOS`: los agentes que vienen en camino (aparecen en gris y en la oficina en obra).

Después de cambiar `config.js` o las instrucciones, se genera de nuevo `chat-worker.js` (`npm run construir` en `servidor/`) y se siguen los tres pasos de arriba.

## Cambiar nombres, enlaces o colores

Todo está en `config.js`: los nombres, la persona a cargo, las frases y los colores de los avatares, el enlace de la Biblioteca de anuncios del Detective, los países y los administradores. Si cambias los administradores, cámbialos también en `firestore.rules`.

Para publicar un cambio, vuelve a comprimir los archivos (sin `firestore.rules` ni este README) y arrástralos al mismo sitio de Netlify, en **Deploys**.
