# SP Graph Viewer

Aplicación web de una sola página para explorar visualmente el grafo de dependencias de los stored procedures (SP) de SQL Server. Permite navegar ~3 700 nodos, buscar por nombre, resaltar vecindarios, consultar dependencias de tablas/vistas/funciones, y filtrar el subconjunto de SPs usados por los programas Big Magic.

---

## Índice

1. [Arquitectura general](#arquitectura-general)
2. [Estructura de archivos](#estructura-de-archivos)
3. [Requisitos](#requisitos)
4. [Instalación y ejecución](#instalación-y-ejecución)
5. [Variables de entorno](#variables-de-entorno)
6. [Cómo funciona](#cómo-funciona)
   - [Fuente de datos](#fuente-de-datos)
   - [Backend](#backend)
   - [Frontend](#frontend)
   - [Filtro Big Magic](#filtro-big-magic)
7. [API](#api)
8. [Tests](#tests)
9. [Logs](#logs)
10. [Solución de problemas](#solución-de-problemas)

---

## Arquitectura general

```
Browser (React + Sigma.js WebGL)
        │   fetch /api/graph
        │   fetch /api/programs
        ▼
FastAPI (Python 3.11+)  ──reads──►  data/mapeos_sp_grafo.json
        │                           data/ProgramasMagic_SP_ADMINISTRATIVO.csv
        └── logs/app.log  ◄── también recibe logs del frontend vía POST /api/log
```

El backend es una API **read-only** que parsea y sirve el JSON de dependencias y el CSV de programas. El frontend construye el grafo en memoria (Graphology), calcula el layout con ForceAtlas2 en un Web Worker, y lo renderiza con Sigma.js (WebGL). No hay base de datos ni estado persistente en el servidor.

---

## Estructura de archivos

```
sp_graph/
├── data/
│   ├── mapeos_sp_grafo.json                    # Fuente de verdad: ~3 704 SPs y sus dependencias
│   ├── mapeos_sp_grafo.info.md                 # Documentación del esquema del JSON
│   └── ProgramasMagic_SP_ADMINISTRATIVO.csv    # 341 programas Magic → 555 SPs
│
├── backend/
│   ├── pyproject.toml                          # Dependencias Python (fastapi, uvicorn, pydantic, pytest, ruff)
│   └── src/sp_graph_api/
│       ├── __main__.py                         # Punto de entrada: python -m sp_graph_api
│       ├── app.py                              # FastAPI app + 4 endpoints
│       ├── config.py                           # Settings leídas de variables de entorno
│       ├── logger.py                           # Logger centralizado (stdout ANSI + archivo rotativo)
│       ├── graph_loader.py                     # Lee/parsea/cachea mapeos_sp_grafo.json
│       ├── program_loader.py                   # Lee/parsea/cachea el CSV de programas Magic
│       └── schemas.py                          # Modelos Pydantic (GraphData, ProgramData, etc.)
│
├── frontend/
│   ├── package.json                            # Dependencias Node (React, Sigma.js, Graphology, Tailwind)
│   ├── vite.config.ts                          # Dev server en :5173, proxy /api → :8000
│   └── src/
│       ├── App.tsx                             # Shell principal: grid de 3 columnas
│       ├── api/client.ts                       # Wrappers fetch tipados
│       ├── graph/
│       │   ├── types.ts                        # Interfaces TypeScript (espejo de schemas.py)
│       │   ├── buildGraph.ts                   # GraphData → Graphology Graph (función pura)
│       │   ├── layout.ts                       # Driver ForceAtlas2 en Web Worker
│       │   ├── search.ts                       # Búsqueda ranked case-insensitive (función pura)
│       │   └── spDetail.ts                     # Derivación de SpDetail para el panel derecho
│       ├── hooks/
│       │   ├── useGraphData.ts                 # Fetch + estado del grafo principal
│       │   ├── useProgramData.ts               # Fetch + estado de programas Magic
│       │   ├── useSelection.ts                 # SP seleccionado + vecindario (callees/callers)
│       │   └── useMagicFilter.ts               # Estado del filtro Big Magic
│       ├── components/
│       │   ├── GraphCanvas.tsx                 # Renderer Sigma WebGL con nodeReducer/edgeReducer
│       │   ├── LeftSidebar.tsx                 # Sidebar izquierdo con tabs Search / Programas
│       │   ├── SearchBar.tsx                   # Input de búsqueda con sugerencias
│       │   ├── ProgramsPanel.tsx               # Lista de programas Magic + toggle filtro
│       │   ├── DetailPanel.tsx                 # Panel derecho: metadatos + dependencias del SP
│       │   ├── Legend.tsx                      # Leyenda de colores
│       │   ├── ErrorBanner.tsx                 # Banner rojo para errores fatales del JSON
│       │   └── WarningBanner.tsx               # Banner ámbar para warnings no-fatales
│       └── logger/index.ts                     # Logger frontend (consola + reenvío al backend)
│
├── logs/
│   └── .gitkeep                                # El archivo app.log se genera en runtime
│
├── specs/001-sp-graph-viewer/                  # Documentación técnica del proyecto
│   ├── spec.md                                 # Especificación funcional completa
│   ├── plan.md                                 # Plan técnico (stack, fases, estructura)
│   ├── tasks.md                                # 46 tareas de implementación
│   ├── research.md                             # Decisiones de diseño y justificaciones
│   ├── data-model.md                           # Modelo de datos detallado
│   ├── quickstart.md                           # Guía de validación de las 4 user stories
│   └── contracts/
│       ├── api.md                              # Contrato de la API en prosa
│       └── openapi.yaml                        # Esquema OpenAPI 3.1
│
└── README.md                                   # Este archivo
```

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.11 |
| Node.js | 20 LTS |
| pnpm | 10+ |

---

## Instalación y ejecución

### 1. Backend

```bash
# Desde la raíz del repositorio
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -e .                   # instala fastapi, uvicorn, pydantic, pydantic-settings
python -m sp_graph_api             # servidor en http://127.0.0.1:8000
```

Verificar que el backend responde:

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok"}

curl http://127.0.0.1:8000/api/graph | python -m json.tool | head -20
curl http://127.0.0.1:8000/api/programs | python -m json.tool | head -20
```

### 2. Frontend

```bash
# En otra terminal, desde la raíz del repositorio
cd frontend
pnpm install
pnpm dev                           # Vite en http://127.0.0.1:5173
```

Abrir `http://127.0.0.1:5173` en un navegador moderno (Chromium, Firefox o Safari, versión reciente). La app requiere WebGL2.

### Build de producción

```bash
cd frontend
pnpm build          # genera frontend/dist/
pnpm preview        # sirve dist/ en :4173 para verificar
```

En producción, apuntar un servidor de archivos estáticos (o `StaticFiles` de FastAPI) al directorio `frontend/dist/` y correr el backend en el mismo hostname.

---

## Variables de entorno

Todas tienen el prefijo `SP_GRAPH_`. Ninguna es obligatoria; los defaults apuntan a las rutas del repositorio.

| Variable | Default | Descripción |
|---|---|---|
| `SP_GRAPH_DATA_PATH` | `data/mapeos_sp_grafo.json` | Ruta al JSON principal de dependencias |
| `SP_GRAPH_PROGRAMS_PATH` | `data/ProgramasMagic_SP_ADMINISTRATIVO.csv` | Ruta al CSV de programas Magic |
| `SP_GRAPH_HOST` | `127.0.0.1` | Host de escucha del servidor |
| `SP_GRAPH_PORT` | `8000` | Puerto del servidor |
| `SP_GRAPH_LOG_LEVEL` | `INFO` | Nivel de log (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`) |
| `SP_GRAPH_LOG_FILE` | `logs/app.log` | Ruta del archivo de log rotativo |
| `NO_COLOR` | no definida | Si está definida, desactiva los colores ANSI en stdout |

Ejemplo con rutas personalizadas:

```bash
SP_GRAPH_DATA_PATH=/ruta/alternativa/grafo.json \
SP_GRAPH_PORT=9000 \
python -m sp_graph_api
```

---

## Cómo funciona

### Fuente de datos

**`data/mapeos_sp_grafo.json`** es el único origen de verdad del grafo. Estructura raíz:

```json
{
  "summary": {
    "total_entries": 3704,
    "total_requerido": 3001,
    "faltantes_en_mapeos_sp": ["SP_SIN_METADATA", ...]
  },
  "mappings": {
    "NOMBRE_DEL_SP": {
      "rol": "requerido",
      "source_sql_server": {
        "lines": 142,
        "dependencies": [
          { "name": "OTRO_SP", "objectType": "Stored Procedure", "schema": "dbo" },
          { "name": "MI_TABLA", "objectType": "Table", "schema": "dbo" }
        ]
      },
      "callers": [
        { "name": "SP_QUE_ME_LLAMA" }
      ]
    }
  }
}
```

Los roles posibles son `requerido`, `adjunto_hijo`, `adjunto_padre` y `adjunto_ambos`. Los SPs en `faltantes_en_mapeos_sp` son **stubs**: están en scope (`requerido`) pero no tienen metadata.

**`data/ProgramasMagic_SP_ADMINISTRATIVO.csv`** mapea programas del sistema Big Magic a sus SPs:

```
#Programa,Nombre de Programa,Stored Procedure
14,Actualiza O.Compra x Factura,PR_ERP_FNZ_QRY_GN_CANTIDADFACTURADAORDENCOMPRAACTUALIZA
20,Graba Ing/Egr a Bancos,PR_ERP_FNZ_QRY_GN_IngresoBancoCreacion
```

### Backend

El backend hace tres cosas:

1. **Parsear y cachear** el JSON (y el CSV) en memoria. La caché se invalida automáticamente cuando el `mtime` del archivo en disco cambia, por lo que editar el archivo y recargar el navegador refleja los cambios sin reiniciar el proceso.

2. **Construir el modelo de grafo**: por cada SP en `mappings` crea un `SpNode`, y por cada dependencia de tipo `Stored Procedure` (deduplicando con los `callers` simétricos) crea una `SpEdge`. Los SPs referenciados que no existen en `mappings` se marcan como **ghosts**. Las dependencias no-SP (tablas, vistas, funciones) se agrupan por SP en `leavesBySp`.

3. **Ejecutar 3 sanity checks** no-fatales al parsear: desajuste de `total_entries`, desajuste de la suma de roles, y shape incorrecto de stubs. Los resultados se exponen como `warnings[]` en la respuesta para que el frontend los muestre.

Si el archivo es ilegible o tiene JSON inválido, el backend responde HTTP 500 con un `ErrorEnvelope` estructurado.

### Frontend

El pipeline de arranque tiene 4 pasos secuenciales:

```
1. useGraphData()      → GET /api/graph     → GraphData
2. buildGraph(data)    → Graphology Graph   (función pura, sin React)
3. startLayout(graph)  → ForceAtlas2 Worker → coordenadas x/y en cada nodo (20 s budget)
4. new Sigma(graph)    → renderer WebGL     → canvas interactivo
```

**Layout**: ForceAtlas2 corre en un Web Worker para no bloquear la UI durante los ~20 segundos de cálculo. Los parámetros clave son `scalingRatio=2000` y `gravity=0.005` para que el grafo se expanda sin colapsar en el centro.

**Renderizado**: Sigma usa `nodeReducer` y `edgeReducer` que leen refs mutables. Esto permite cambiar la selección sin desmontar ni re-correr el layout (que tarda ~20 s). El `nodeReducer` aplica colores con esta prioridad:

| Prioridad | Condición | Color |
|---|---|---|
| 1 | SP seleccionado | color base del rol |
| 2 | callee (SP que llama el seleccionado) | `#fb923c` naranja |
| 3 | caller (SP que llama al seleccionado) | `#a78bfa` violeta |
| 4 | SP del programa Big Magic seleccionado | `#06b6d4` cyan |
| 5 | Filtro Magic activo, modo `filter`, nodo no-Magic | `hidden: true` |
| 6 | Filtro Magic activo, modo `highlight`, nodo no-Magic | 15% tamaño, sin label |
| — | Default por rol | ver tabla de paleta abajo |

**Paleta de nodos por rol**:

| Color | Rol / tipo |
|---|---|
| `#10b981` esmeralda | `requerido` |
| `#64748b` slate | `adjunto_hijo` / `adjunto_padre` / `adjunto_ambos` |
| `#fbbf24` ámbar | stub (requerido sin metadata) |
| `#3f3f46` zinc | ghost (referenciado, no existe en el JSON) |

**Búsqueda**: función pura `searchSps(query, names)` con scoring `exact=0 < prefix=1 < substring=10+posición`. Retorna top 10 resultados, casing original preservado.

**Logger unificado**: DEBUG e INFO van solo a la consola del navegador. WARNING, ERROR y CRITICAL se reenvían también vía `POST /api/log` al backend, que los persiste en `logs/app.log`. El mismo archivo contiene logs del servidor y del cliente.

### Filtro Big Magic

La feature "SPs Big Magic" agrega dos dimensiones a la navegación:

**Tab "Programas"** (sidebar izquierdo):
- Lista los 341 programas del CSV, filtrables por nombre o número.
- Al hacer click en un programa, sus SPs se resaltan en **cyan** en el canvas.
- El toggle **"SPs Big Magic"** activa el filtro global sobre los 555 SPs del CSV.
- El switch **Resaltar / Solo Magic** controla si los SPs no-Magic se muestran tenues (highlight) o se ocultan completamente (filter).

**Sección "Big Magic Programs"** (panel derecho):
- Cuando se selecciona un SP que aparece en el CSV, el panel derecho muestra la sección "Big Magic Programs" con los programas que usan ese SP.
- Cada fila es clickable para seleccionar ese programa en el canvas.

---

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Liveness probe. No toca el disco. Siempre 200. |
| `GET` | `/api/graph` | Grafo completo: nodos, aristas, ghosts, hojas, warnings. |
| `GET` | `/api/programs` | 341 programas Magic y mapa SP→programas. |
| `POST` | `/api/log` | Recibe un registro de log del frontend (WARNING/ERROR/CRITICAL). |

Esquema completo en [`specs/001-sp-graph-viewer/contracts/openapi.yaml`](specs/001-sp-graph-viewer/contracts/openapi.yaml).

**Respuesta de `/api/graph` (resumen)**:

```jsonc
{
  "meta": { "totalEntries": 3704, "totalRequerido": 3001, ... },
  "nodes": [ { "id": "SP_NAME", "rol": "requerido", "lines": 142, "isStub": false, ... } ],
  "edges": [ { "id": "A->B", "source": "A", "target": "B" } ],
  "ghosts": [ "SP_SIN_ENTRADA" ],
  "leavesBySp": { "SP_NAME": [ { "name": "TABLA", "schema": "dbo", "objectType": "Table" } ] },
  "warnings": []
}
```

**Respuesta de `/api/programs` (resumen)**:

```jsonc
{
  "programs": [
    { "num": 14, "name": "Actualiza O.Compra x Factura", "spIds": ["PR_ERP_FNZ_QRY_..."] }
  ],
  "spToPrograms": {
    "PR_ERP_FNZ_QRY_GN_CANTIDADFACTURADAORDENCOMPRAACTUALIZA": [14, 1069]
  }
}
```

---

## Tests

```bash
# Backend (pytest)
cd backend
pytest -q

# Frontend (Vitest)
cd frontend
pnpm test
```

Los tests son intencionalmente reducidos (constitución, Principio V): cubren los contratos críticos del loader de grafo, los endpoints de la API, y la función pura `buildGraph`.

---

## Logs

```bash
# Seguir el log en tiempo real
tail -F logs/app.log
```

El archivo se crea automáticamente en el primer arranque del backend. Rota al llegar a 10 MB (máximo 5 backups). Contiene registros del servidor **y** los WARN/ERROR/CRITICAL del navegador reenviados vía `POST /api/log`.

Formato de cada línea:

```
[INFO] 2026-05-28T14:32:01Z sp_graph_api.graph_loader :: Built graph: 3704 nodes, 3001 edges, 0 ghosts, 0 warnings
[WARNING] 2026-05-28T14:33:10Z frontend.hooks/useGraphData :: graph fetch failed (client_ts=..., context=...)
```

---

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| La carga inicial tarda más de 10 s | El backend está re-parseando el JSON en cada request. Verificar que otro proceso no esté tocando el archivo constantemente (la caché de mtime debe estabilizarse). |
| El canvas queda en blanco sin error visible | El navegador no tiene soporte WebGL2. Usar Chromium, Firefox o Safari reciente. |
| La búsqueda no devuelve sugerencias para nombres conocidos | El frontend no recibió `/api/graph`. Verificar en la pestaña Network del DevTools. Si el backend devolvió 500, el ErrorBanner debería estar visible. |
| Los cambios en el JSON no se reflejan al recargar | Verificar que el archivo se guardó (el mtime debe cambiar). En desarrollo, probar con hard-reload (Ctrl+Shift+R) para descartar caché del navegador. |
| El tab "Programas" muestra "Cargando..." indefinidamente | `/api/programs` falló (CSV no encontrado o mal formado). Revisar `logs/app.log` para el error. |
| Nodos cyan no aparecen al seleccionar un programa | El SP del CSV tiene prefijo `DBO.` que no se normalizó correctamente, o el nombre difiere en mayúsculas/minúsculas respecto al JSON. Verificar en la consola del navegador. |
