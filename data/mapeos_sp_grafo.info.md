# mapeos_sp_grafo.json — Guia para el visualizador web

Acompana a `mapeos_sp_grafo.json` (5.94 MB). Lee esto **antes** de disenar la app de visualizacion del grafo.

## Que es este archivo

Subgrafo de stored procedures del SQL Server origen (`MXBDAJE`) relevantes a `fase3/listaSPTotal.txt`, mas sus vecinos inmediatos (1-hop callees y callers). 3704 nodos SP. Fuente de verdad para construir un grafo dirigido de dependencias entre SPs.

**No es** el universo completo de SPs (4586 originales). Es un subset filtrado por relevancia a fase3.

Regenerable: `python3 fase3/scripts/build_sp_grafo.py`

## Estructura top-level

```json
{
  "description": { /* metadata del archivo, no datos */ },
  "summary": {
    "total_entries":         3704,
    "total_requerido":       3001,
    "total_adjunto_hijo":      11,
    "total_adjunto_padre":    681,
    "total_adjunto_ambos":     11,
    "faltantes_en_mapeos_sp": [ /* 26 SPs sin data — son stubs */ ]
  },
  "mappings": {
    "<SP_NAME>": { /* ver siguiente seccion */ },
    ...
  }
}
```

Las claves de `mappings` son nombres de SP **case-sensitive**, sin prefijo `dbo.`. Ejemplos: `ACTUALIZA_COMPROBANTE`, `Nxt_getListaPrecioRecargaArticulo`. El casing es el original del SS — algunos SPs son ALL_CAPS, otros CamelCase. Trata los nombres como cadenas opacas.

## Shape de cada entry

```json
"ALERTA_ADM_ACT_EXTRACTOS_BANCARIOS": {
  "rol": "adjunto_padre",
  "source_sql_server": {
    "procedure_name": "ALERTA_ADM_ACT_EXTRACTOS_BANCARIOS",
    "lines": 97,
    "dependencies": [
      {"name": "ALERTA_LISTAR_USUARIOS",   "schema": "dbo", "objectType": "Stored Procedure"},
      {"name": "FC_INTEGERDATE",           "schema": "dbo", "objectType": "Scalar Function"},
      {"name": "LOG_HISTORY_ALERT",        "schema": "dbo", "objectType": "OBJECT_OR_COLUMN"},
      {"name": "MBANCO1F",                 "schema": "dbo", "objectType": "Table"}
    ]
  },
  "callers": [
    {"name": "OTRO_SP_QUE_LO_LLAMA", "schema": "dbo"}
  ]
}
```

### Campos

| Campo | Tipo | Notas |
|---|---|---|
| `rol` | string | uno de: `requerido`, `adjunto_hijo`, `adjunto_padre`, `adjunto_ambos` |
| `source_sql_server.procedure_name` | string | redundante con la clave del mapping (igual valor) |
| `source_sql_server.lines` | int \| null | `null` si el SP es un stub (no estaba en `mapeos_sp.json` original) |
| `source_sql_server.dependencies` | array | objetos que ESTE SP usa (forward edges / out-edges) |
| `callers` | array | SPs que LLAMAN a este SP (reverse edges / in-edges) |

### Valores posibles de `rol`

| rol | Significado | Acciones de UI sugeridas |
|---|---|---|
| `requerido` | SP listado en `fase3/listaSPTotal.txt` (foco de la migracion) | resaltar/destacar (ej. color primario, borde grueso) |
| `adjunto_hijo` | SP NO en lista pero LLAMADO por al menos un requerido | color secundario, descendiente |
| `adjunto_padre` | SP NO en lista pero que LLAMA a al menos un requerido | color terciario, ancestro |
| `adjunto_ambos` | SP NO en lista que es padre Y hijo de requeridos | color cuarto / marcar como especial |

Los conteos viven en `summary` (ver arriba). Util para badges/leyenda.

### Valores posibles de `objectType` en `dependencies`

| objectType | Conteo aprox | Es un SP? |
|---|---|---|
| `Table` | 28374 | no — hoja del grafo |
| `Scalar Function` | 7104 | no — UDF |
| `Stored Procedure` | **2803** | **SI — esto es lo que forma aristas SP→SP** |
| `OBJECT_OR_COLUMN` | 918 | desconocido — no se pudo resolver |
| `Table Function` | 462 | no — UDF |
| `View` | 251 | no — hoja |
| `TYPE` | 5 | no |
| `Inline Function` | 1 | no |

**Para construir aristas del grafo de SPs**: filtra `dependencies` por `objectType == "Stored Procedure"`. El resto son hojas (tablas/UDFs/vistas) — opcionalmente las puedes mostrar como nodos secundarios con otro estilo, o ocultarlas detras de un toggle.

### Direccion de las aristas

- `mappings[A].dependencies` con `objectType=Stored Procedure` `{name: B, ...}` significa **A llama a B** (A → B).
- `mappings[B].callers` con `{name: A, ...}` significa **A llama a B** (A → B).

Los dos caminos describen la misma arista. **Ambos estan presentes** para permitir recorridos en cualquier direccion sin reindexar. Si la app construye un set de aristas, deduplica.

## Caveats importantes para la app

### 1. Referencias colgantes (by design)

Politica de inclusion: 1-hop. Un `adjunto_padre` puede tener entradas en `dependencies` o `callers` que **apunten a SPs sin entry en este archivo** (porque caen fuera del subgrafo). 

La app debe:
- Tolerar `name` en `dependencies` o `callers` que no exista en `mappings`.
- Mostrarlos como nodos "fantasma" (estilo distinto, ej. dashed) o filtrarlos. **No crashear**.
- Opcionalmente, ofrecer un boton "expandir vecinos" que dispare otra carga.

### 2. Stubs (26 SPs)

Los 26 SPs listados en `summary.faltantes_en_mapeos_sp` tienen:
- `rol: "requerido"`
- `lines: null`
- `dependencies: []`
- `callers` puede o no estar vacio

Renderiza algo visualmente distinto (ej. nodo gris, icono de warning, tooltip "SP en lista pero sin metadata"). No los ocultes — son requeridos.

### 3. Auto-loops y ciclos

El grafo SP→SP **tiene ciclos** (SS no impide recursion mutua entre SPs). Ejemplos clasicos en este dataset: cadenas `PR_ERP_COM_QRY_WS_*` donde A llama B, B llama A.

La app:
- Para layouts force-directed: ok, lo manejan natural.
- Para layouts jerarquicos (dagre, sugiyama): detectar SCCs primero o se cuelgan.
- Para travesias DFS: usar `visited` set para no recurrir infinitamente.

### 4. `OBJECT_OR_COLUMN` residual

918 dependencias quedaron sin resolver (el resolver intento contra SPs, Tablas, UDFs, Views conocidos). Significan: objetos referenciados via SQL dinamico o nombres que no estan en ningun mapeo conocido. Trata como hoja "desconocida" — no asumas que es SP.

### 5. Tamaño y carga

5.94 MB es pequeno para JSON pero grande para `JSON.parse` sincronico en frontend. Recomendaciones:
- Carga via `fetch` con `await response.json()` (asincrono).
- Considera servirlo gzipped (Vite/Webpack lo hace en build, o usa nginx `gzip_static`).
- Si quieres lazy-loading por nodo, particiona en chunks por primera letra del SP (genera N archivos de ~250 entries c/u con un script aparte).
- No reconstruyas el adyacency dict por cada render — memoiza.

### 6. Performance del render

3704 nodos + ~3000 aristas SP→SP es **demasiado** para Cytoscape/D3 sin tuning. Estrategias:
- **Por defecto, no muestres tablas/UDFs/vistas como nodos**. Solo SPs. Eso reduce drasticamente la densidad visual.
- Filtrar inicialmente por `rol == "requerido"` y permitir expandir adjuntos al hover/click.
- Layouts: para 3k nodos usa `cose-bilkent` o `fcose` (Cytoscape), no `cose` ni `dagre` directo.
- WebGL backends: sigma.js, pixi-based, o react-force-graph (Three.js) si el usuario quiere ver todo a la vez.
- Clustering: agrupa por prefijo de nombre (ej. `ALERTA_*`, `PR_ERP_*`, `SCM_*`, `USP_*`) — muchos SPs comparten prefix funcional.

### 7. Naming conventions detectables

Los prefijos del nombre del SP transmiten dominio/modulo:
- `PR_ERP_<MOD>_<ACTION>_<NAME>` — convencion moderna (ej. `PR_ERP_FNZ_INS_*`, `PR_ERP_COM_QRY_*`)
- `USP_*` — user stored procs (mezcla)
- `SCM_*` — supply chain
- `ADM_*` — admin
- `ALERTA_*` — sistema de alertas
- `Nxt_*`, `rpm_*` — modulos mobile/router
- Resto — legacy sin prefijo claro

Util para clustering automatico o filtros por modulo en la UI.

## Esquema sugerido para nodos y aristas (modelo grafo)

```ts
type SpRol = "requerido" | "adjunto_hijo" | "adjunto_padre" | "adjunto_ambos";

interface SpNode {
  id: string;                  // = nombre del SP (clave en mappings)
  rol: SpRol;
  lines: number | null;        // null si stub
  isStub: boolean;             // lines === null && dependencies.length === 0
  outDegreeSp: number;         // count de deps con objectType==Stored Procedure
  inDegreeSp: number;          // = callers.length
  module?: string;             // derivado del prefijo si aplica
}

interface SpEdge {
  source: string;              // SP que llama
  target: string;              // SP llamado
  // (no hay metadata adicional por ahora — todas las aristas son "llama a")
}

// Hojas opcionales (si quieres mostrarlas):
type LeafType = "Table" | "View" | "Scalar Function" | "Table Function"
              | "Inline Function" | "OBJECT_OR_COLUMN" | "TYPE";
interface LeafNode {
  id: string;                  // nombre del objeto + tipo (puede haber colisiones por nombre solo)
  type: LeafType;
  schema: string;              // siempre "dbo" en este dataset
}
```

Construccion de aristas SP→SP en 1 pase (pseudocodigo):

```js
const edges = new Set();
for (const [spName, entry] of Object.entries(data.mappings)) {
  for (const dep of entry.source_sql_server.dependencies) {
    if (dep.objectType === "Stored Procedure") {
      edges.add(`${spName}->${dep.name}`);
    }
  }
  // Las callers ya estan cubiertas por dependencies del otro lado,
  // pero si quieres reforzar (por si hay asimetrias en el dataset):
  for (const c of entry.callers) {
    edges.add(`${c.name}->${spName}`);
  }
}
```

(Asimetrias posibles: callers proviene de `sp_deps_chilren_all.json` que es un dataset distinto; en raros casos un SP aparece en callers pero no como dep recibida del otro lado, o viceversa. Usar Set como arriba deduplica automaticamente.)

## Que NO esta en este archivo (limites)

- No esta el T-SQL ni el codigo PL/pgSQL de los SPs. Si el visualizador quiere mostrarlo, debe leer separadamente:
  - SS original: `fase3/sp_a_migrar/tsql/<SP>.sql`
  - PG migrado (si existe): `fase3/plpgsql/traduccion_exitosa/<SP>.sql` o `fase3/capa1/sp_corregidos/<SP>.sql`
- No esta el estado de migracion (migrado/pendiente/revision_manual). Si lo necesitas, joinea con `mapeos/mapeos_sp.json` campo `migration_status`, o con `fase3/sp_migrados_pg.txt` para los completados.
- No hay info de triggers, vistas, ni UDFs como nodos de primera clase. Si el grafo crece a esos objetos, mira `mapeos/mapeos_view.json`, `mapeos/mapeos_udf.json`, `mapeos/mapeo_triggers.json`.

## Validacion del archivo (sanity checks ante un dataset corrupto)

Al cargar, verifica:
```js
assert(data.summary.total_entries === Object.keys(data.mappings).length);
assert(data.summary.total_requerido + data.summary.total_adjunto_hijo
       + data.summary.total_adjunto_padre + data.summary.total_adjunto_ambos
       === data.summary.total_entries);
// Todos los faltantes deben ser stubs:
for (const fn of data.summary.faltantes_en_mapeos_sp) {
  const e = data.mappings[fn];
  assert(e && e.rol === "requerido" && e.source_sql_server.lines === null);
}
```

Si fallan: regenerar con `python3 fase3/scripts/build_sp_grafo.py`.

## Ideas para la UI (no obligatorias)

- Panel de filtros: por `rol`, por modulo (prefijo), por presencia de callers/dependencies, por status de migracion (si haces join).
- Busqueda fuzzy por nombre (3704 nombres, cabe en memoria).
- Click en nodo → side panel con: rol, lines, lista de dependencies agrupadas por objectType, lista de callers, links a T-SQL/PL/pgSQL si existen.
- Highlight de path: dado dos SPs, mostrar la cadena de llamadas si existe.
- Vista alternativa: matrix view (adjacency matrix) para detectar clusters densos visualmente.
- Layout togglable: force-directed (overview) vs hierarchical (cuando el subgrafo seleccionado es DAG).
