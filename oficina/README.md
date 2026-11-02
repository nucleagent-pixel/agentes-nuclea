# Oficina NUCLEA

El tablero de productos y la oficina en pixel art donde trabajan Inés (Investigadora), Teo (Creador de producto) y Gabi (Guionista).

- Cada producto es una tarjeta que pasa por tres turnos: Investigación, Producto y Guiones.
- Quien toma un turno abre su agente (Claude in Chrome o el Proyecto de Claude), pega el expediente anterior y, al terminar, pega el expediente nuevo y lo entrega.
- En la oficina, el avatar del agente camina a su escritorio cuando alguien tomó su turno. Si hay productos esperando, se lo dice en un globo.
- Para verla con datos de ejemplo, sin iniciar sesión, abre la dirección con `?demo=1` al final.

## Instalación (una sola vez)

1. **Reglas de seguridad.** En Firebase (proyecto `agents-730ec`), entra a Firestore Database → **Reglas**. Borra lo que hay, pega el contenido de `firestore.rules` y pulsa **Publicar**.
2. **Publicar en Netlify.** Entra a https://app.netlify.com/drop y arrastra `oficina-nuclea.zip`. Netlify te da una dirección, por ejemplo `oficina-nuclea.netlify.app`. Puedes cambiar el nombre en la configuración del sitio.
3. **Autorizar esa dirección en Firebase.** Ve a Authentication → Configuración → **Dominios autorizados** → Agregar dominio, y pega la dirección de Netlify sin `https://`.
4. **Entrar.** Abre la dirección y entra con la cuenta `nucleagent@gmail.com`. En **Equipo**, agrega el correo de Google y el nombre de cada persona.

## Cambiar nombres, enlaces o colores

Todo está en `config.js`: los nombres y colores de los avatares, el enlace que abre cada agente (por ejemplo, el de cada Proyecto de Claude), los países y los administradores. Si cambias los administradores, cámbialos también en `firestore.rules`.

Para publicar un cambio, vuelve a comprimir los archivos (sin `firestore.rules` ni este README) y arrástralos al mismo sitio de Netlify, en **Deploys**.
