# Agentes de la Fábrica de productos

Tres agentes que trabajan en cadena sobre un mismo **expediente de producto**:

1. [Investigador](1-investigador.md): encuentra infoproductos validados en Brasil y México según los anuncios activos en Meta.
2. [Creador de producto](2-creador-de-producto.md): crea la app del reto (.zip de un solo `index.html` para Netlify) y los bonos en PDF.
3. [Guionista](3-guionista.md): escribe los guiones de video y el flujo de venta para Leona.

Cada agente termina su respuesta con un bloque `=== EXPEDIENTE · TURNO N ===`. Ese bloque es lo que conecta a un agente con el siguiente.

## Usarlos hoy como Proyectos de Claude

1. En claude.ai, crea tres Proyectos: "1 · Investigador", "2 · Creador de producto" y "3 · Guionista".
2. En cada Proyecto, pega en **Instrucciones** el texto que está debajo de la línea `---` de su archivo.
3. En cada Proyecto, sube a **Conocimiento** un ejemplo real. En el Creador, el .zip de un reto anterior (por ejemplo, Reto Acero 30D), y activa la opción de crear archivos para que entregue el .zip; en el Guionista, un flujo de Leona que haya funcionado, **sin datos bancarios**.
4. El turno 1 termina con el expediente. La persona del turno 2 lo pega en un chat nuevo del Proyecto "2". El turno 3 recibe el expediente con los turnos 1 y 2.

Para el equipo: guarden cada expediente terminado en una carpeta compartida (por ejemplo, en Drive), con el nombre del producto.

## Después: la app

La app "Fábrica de productos" va a usar estas mismas instrucciones. La diferencia es que el expediente pasará solo de un turno al siguiente, y que el PDF y el .zip se armarán automáticamente.
