# Feature Specification: Stored-Procedure Dependency Graph Viewer

**Feature Branch**: `001-sp-graph-viewer`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Requiero una app web de una sola pagina donde pueda ver un grafo de
todos los procedures (lee /home/dirac/sp_graph/data/mapeos_sp_grafo.info.md) para mas info.
Visualmente al inicio solo deben estar los nodos de los 3k procedures, el usuario puede moverse
sobre el canvas para explorarlos, ya que a primera vista apareceran nodos muy pequeños para que
se vean todos. Mientras el usaurio hace zoom o se mueve por el canvas puede ver 1. los nombres
de los proceures, las aristas y sus conexiones, ya sea los sp que dependen de el como los sp a
los que este depende. Los nodos de procedures que aparecen en el json como 'requerido' deben
ser de un color llamativo como verde o azul, y los nodos de sp que no, deben tener un color
apagado. La pagina tambien debe tener una especie de formulario para buscar un sp y ademas
opciones para 1. Si se busca ese sp, y existe, al hacer click la pagina debe mostrar ese sp y
ademas resaltar a sus vecinos, 2. A buscar ese sp se debe tener la opcion de 'listar' ya sea
los sp hijos o los sp padres, asi como las tablas que se usan'. 3. La app web debe estar
construida de tal forma que si yo modifico alguna entrada en
/home/dirac/sp_graph/data/mapeos_sp_grafo.json por ejemplo borro o agrego un procedure o
dependencia, entonces esto se debe reflejar en el app web, utiliza un mecanismo adecuado, el
usuario solo tendria que recargar la pagina o yo como dev deberia reiniciar la app para ver los
cambios"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore the full stored-procedure graph (Priority: P1)

As an engineer exploring the SQL Server migration scope, I open the single-page app and
immediately see the entire stored-procedure (SP) dependency graph in a panable, zoomable canvas.
At maximum zoom-out the ~3,704 SP nodes appear as small dots so I can grasp overall density and
clusters. As I zoom in and pan across regions, node names and the directed edges between SPs
progressively become visible. SPs flagged as "requerido" (in scope for the migration) stand out
with a vivid color (green or blue) while every other SP role appears in a muted tone, so the
in-scope subset is visually obvious at every zoom level.

**Why this priority**: This is the core value of the tool — making a 3.7k-node dependency graph
visually navigable. Without it, the rest of the features have nowhere to render their output.
This story alone is a deliverable MVP that already replaces ad-hoc JSON inspection.

**Independent Test**: Open the app fresh against the production data file; verify that all
in-scope ("requerido") SPs render in the vivid color, non-requerido SPs render in the muted
color, pan/zoom feels responsive, and the level of detail (names, edges) reveals itself as the
user zooms in. No search, detail panel, or live-reload behavior is required for this story to
deliver value.

**Acceptance Scenarios**:

1. **Given** the data file contains 3,704 SP entries, **When** the user loads the page, **Then**
   the user sees a single canvas showing every SP as a node within 5 seconds on a typical
   broadband connection and a modern desktop browser, with no individual labels visible at the
   default zoom-out level.
2. **Given** the graph is rendered at default zoom, **When** the user zooms in on a region,
   **Then** SP names and the directed edges between visible SPs become readable, and edges
   visually distinguish "this SP calls X" from "this SP is called by Y" (e.g., direction
   indicated by arrowhead or equivalent visual cue).
3. **Given** the data file marks 3,001 SPs as `rol = "requerido"`, **When** the graph renders,
   **Then** those 3,001 nodes are drawn in a vivid in-scope color while the remaining 703 nodes
   (any of `adjunto_hijo`, `adjunto_padre`, `adjunto_ambos`) are drawn in a muted color and are
   visually distinguishable from one another at hover or close zoom.
4. **Given** the graph is rendered, **When** the user pans with mouse drag or trackpad, **Then**
   the canvas follows the cursor smoothly without dropping frames or freezing the UI.
5. **Given** an SP in the data file references a callee or caller that is **not** present as its
   own entry (a dangling reference outside the 1-hop subgraph), **When** the graph renders,
   **Then** that reference is shown as a visually distinct "ghost" node (e.g., dashed outline,
   different color) without breaking the layout or producing an error.
6. **Given** the data file lists 26 stub SPs (in `summary.faltantes_en_mapeos_sp`, missing
   metadata), **When** the graph renders, **Then** those 26 SPs appear as nodes with a visually
   distinct style (e.g., warning marker or gray fill) and a hover tooltip that explains they are
   in-scope but have no metadata.

---

### User Story 2 - Search for an SP and highlight its neighborhood (Priority: P2)

As a user inspecting a specific stored procedure, I type its name into a search field. If a
matching SP exists in the data, I can confirm it and the canvas re-focuses on that SP, brings
it to the center of the visible area, visually highlights it, and visually highlights all of
its direct neighbors (every SP that calls it and every SP that it calls). Non-neighbor nodes
fade into the background so the relationship is obvious at a glance.

**Why this priority**: Without search, locating a specific SP in a 3.7k-node graph is
impractical. This is the second most valuable interaction after raw exploration.

**Independent Test**: Without depending on the detail listings (US3) or live reload (US4),
verify that typing a known SP name surfaces it (with suggestion/match feedback) and that
confirming the match centers and highlights that SP plus exactly the union of its direct
callees and callers, with all other nodes visually de-emphasized.

**Acceptance Scenarios**:

1. **Given** the user types text in the search field, **When** the typed text matches the prefix
   or substring of one or more SP names (case-insensitive), **Then** the user sees a ranked list
   of up to 10 matching SP names suggested below the field.
2. **Given** a search result is visible, **When** the user selects a match (click or Enter),
   **Then** the canvas pans and/or zooms so the selected SP is visible and centered, the
   selected SP is rendered with a strong selection style, and every direct neighbor (callees and
   callers) is rendered with a highlight style.
3. **Given** an SP is in the selected/highlighted state, **When** the user selects a different
   SP (via search or by clicking a node), **Then** the previous selection is cleared and the
   new SP becomes the selected one.
4. **Given** the user clears the search field or clicks the canvas background, **When** the
   action completes, **Then** all selection and highlight styling is removed and the graph
   returns to its default appearance.
5. **Given** the user types a search term with no matches, **When** the search runs, **Then**
   the UI shows a clear "no SP matches that name" message and does not modify the graph view.

---

### User Story 3 - List a selected SP's children, parents, and tables (Priority: P3)

As a user investigating a specific SP, after I have selected it (via search or by clicking the
node), I can choose to list:

- its **child SPs** (the SPs that this SP calls),
- its **parent SPs** (the SPs that call this SP), and
- the **tables** the SP uses (plus, for completeness, the other non-SP database objects it
  references — views, scalar/table functions, unresolved object references).

Each list is shown in a side/detail panel anchored to the selected SP, sorted alphabetically,
with counts in the section header, so I can read the SP's full immediate dependency surface
without parsing the graph visually.

**Why this priority**: Reading a textual list is far faster than tracing edges for many tasks
(impact analysis, migration triage). This story builds on US2's selection state and on the
underlying data, but is independently valuable: even without graph rendering, the lists are
useful.

**Independent Test**: Select an SP and trigger the listing action; verify that the panel shows
correct counts and items for callees, callers, and referenced tables/objects against the data
file as ground truth, and that the lists update when the selection changes.

**Acceptance Scenarios**:

1. **Given** an SP is selected, **When** the user opens the detail panel (it MAY open
   automatically on selection), **Then** the panel shows the SP's name, role
   (`requerido` / `adjunto_hijo` / `adjunto_padre` / `adjunto_ambos`), line count (or a "no
   metadata" note for stubs), child SP count, parent SP count, and counts of referenced
   tables, views, and functions.
2. **Given** the detail panel is open, **When** the user expands the "Children (SPs called by
   this SP)" section, **Then** the panel lists every SP this one calls, alphabetically sorted,
   each item clickable to re-select that SP.
3. **Given** the detail panel is open, **When** the user expands the "Parents (SPs that call
   this SP)" section, **Then** the panel lists every SP that calls this one, alphabetically
   sorted, each item clickable to re-select that SP.
4. **Given** the detail panel is open, **When** the user expands the "Tables and other objects
   used" section, **Then** the panel lists every non-SP referenced object (tables, views,
   scalar functions, table functions, inline functions, type references, and unresolved
   `OBJECT_OR_COLUMN` items), grouped by object type with the type name as a subheader.
5. **Given** a selected SP has zero items in a given list (e.g., a leaf SP with no callers),
   **When** the user expands that section, **Then** the panel shows an explicit empty-state
   message (e.g., "No parent SPs"), not a blank area.
6. **Given** the user clicks a child or parent SP name in the panel, **When** the click is
   handled, **Then** that SP becomes the new selection, the graph re-centers on it, and the
   panel refreshes to show the newly selected SP's lists.

---

### User Story 4 - Reflect data-file edits on page reload (Priority: P4)

As a developer maintaining the data, I edit `data/mapeos_sp_grafo.json` directly — adding,
removing, or modifying SP entries, dependencies, or callers. After my edit is saved, either a
plain browser reload by an end user **or** a process restart by me as the developer surfaces
the changes; no rebuild step is required. If the file becomes invalid or unreadable, the app
shows a clear error state rather than silently serving stale data or crashing.

**Why this priority**: This unblocks iterative data work. Without it, every data edit requires
a manual reprocessing step the user explicitly does not want. It is lowest priority because
the static MVP is already valuable; this is workflow polish.

**Independent Test**: With the app running, modify a known SP entry in the JSON file (add a
node, remove a dependency, change a role). Without rebuilding the frontend, perform a page
reload (or restart the backing process, per the chosen mechanism) and verify the change is
visible in the graph, search results, and detail panel.

**Acceptance Scenarios**:

1. **Given** the app is running and the JSON file is valid, **When** the user (or developer)
   edits the JSON on disk and then reloads the page in the browser, **Then** the rendered graph
   reflects the new state of the file (added nodes appear, removed nodes are gone, edge changes
   are reflected) without any manual rebuild or redeploy step.
2. **Given** the developer chooses to restart the backing process instead of relying on
   per-request re-reads, **When** they restart the process and reload the page, **Then** the
   rendered graph reflects the latest on-disk state.
3. **Given** the JSON file is malformed (invalid JSON syntax) at reload time, **When** the page
   reloads, **Then** the user sees an explicit error message identifying the data file and a
   diagnostic hint (e.g., "Could not parse data file: <reason>"), and the previous successfully
   loaded view is not silently displayed as if it were current.
4. **Given** the JSON file is structurally valid but fails the sanity checks documented in the
   data guide (counts mismatch, stubs missing required shape), **When** the page reloads,
   **Then** the user sees a warning banner naming the inconsistency and the graph still renders
   (best-effort) so the developer can fix the file.

---

### Edge Cases

- **Cycles in the SP→SP graph**: The data is known to contain mutual recursion (e.g.,
  `PR_ERP_COM_QRY_WS_*` chains). The visualization, selection, and any neighborhood-traversal
  logic MUST terminate on cyclic input.
- **Self-loop edge**: An SP whose dependencies list includes itself MUST render without
  visual artifacts and MUST not be double-counted in child/parent lists.
- **Very large neighborhood**: Some SPs may have hundreds of callers or callees; the detail
  panel MUST handle long lists (scrolling, virtualization if needed) without freezing.
- **Search with empty input**: Pressing Enter or clicking search with no input is a no-op (no
  error, no graph change).
- **Search case sensitivity**: SP names are case-sensitive in the source data, but the search
  field MUST match case-insensitively to be usable; the suggestion list MUST display names in
  their original casing.
- **Duplicate dependency entries**: If the same SP→SP edge is implied by both
  `dependencies` and the symmetric `callers` array, it MUST be deduplicated visually
  (single edge drawn).
- **Browser back/forward navigation**: A page reload mid-exploration is acceptable to lose
  transient selection state; persisting selection in the URL is out of scope for this feature.
- **Concurrent edits to the data file**: If the file is being written when the app re-reads
  it, the app MUST detect parse failure (per Acceptance Scenario US4-3) rather than render
  partial data.
- **Touchscreen / non-mouse input**: Pinch-to-zoom and one-finger pan SHOULD work on
  touchscreen devices, but mouse/trackpad is the primary supported input.

## Requirements *(mandatory)*

### Functional Requirements

**Graph data and rendering**

- **FR-001**: The system MUST read its graph data from the file at
  `data/mapeos_sp_grafo.json` relative to the project root and treat it as the single source of
  truth for nodes, edges, roles, and metadata.
- **FR-002**: The system MUST render every SP entry from `mappings` as a graph node, including
  the 26 stub SPs listed in `summary.faltantes_en_mapeos_sp`.
- **FR-003**: The system MUST draw a directed edge `A → B` whenever `A`'s `dependencies` list
  contains an item with `objectType == "Stored Procedure"` and `name == B`. The same logical
  edge implied by `B.callers` containing `A` MUST be deduplicated and rendered only once.
- **FR-004**: The system MUST distinguish SP nodes by `rol` with a clear two-tier visual
  palette: nodes with `rol == "requerido"` are drawn in a vivid in-scope color (green or
  blue); nodes with any other `rol` are drawn in a muted color. Within the muted tier,
  `adjunto_hijo`, `adjunto_padre`, and `adjunto_ambos` MUST be visually distinguishable from
  each other (e.g., different muted hues or markers).
- **FR-005**: The system MUST render referenced SPs that have no entry in `mappings` (dangling
  references at the 1-hop subgraph boundary) as visually distinct "ghost" nodes so users can
  tell they are outside the dataset.
- **FR-006**: The system MUST render the 26 stub SPs with a visual indicator (e.g., warning
  marker, gray fill) that distinguishes them from fully-populated SPs and MUST surface a hover
  tooltip explaining that they are in-scope but missing metadata.

**Navigation and level of detail**

- **FR-007**: The system MUST present the graph in a single canvas that supports pan (drag) and
  zoom (mouse wheel, pinch, or equivalent).
- **FR-008**: At the maximum zoom-out level the system MUST show all SP nodes at once without
  node labels visible; node labels and edge details MUST become visible as the user zooms in.
- **FR-009**: At interactive zoom levels the system MUST visually convey edge direction
  (arrowhead, gradient, or equivalent) so users can tell callee from caller.

**Search**

- **FR-010**: The system MUST provide a single search input visible at all times on the page.
- **FR-011**: The search MUST match SP names case-insensitively against both prefix and
  substring matches, ranking exact and prefix matches above substring matches, and MUST surface
  up to 10 suggestions below the input as the user types.
- **FR-012**: Selecting a search match (click or Enter) MUST: (a) re-center/zoom the canvas so
  the selected SP is visible and centered, (b) apply a selection style to the selected SP, and
  (c) apply a highlight style to every direct neighbor (callees and callers).
- **FR-013**: Selecting a search match MUST visually de-emphasize all non-selected,
  non-neighbor nodes (e.g., reduce opacity) so the focused neighborhood stands out.
- **FR-014**: Clicking the canvas background or clearing the search field MUST remove all
  selection/highlight styling and return the graph to its default appearance.
- **FR-015**: A search that yields zero matches MUST display a clear empty-state message and
  MUST NOT modify the canvas.

**Detail panel**

- **FR-016**: When an SP is selected (via search or by clicking its node), the system MUST
  display a detail panel showing the SP's name, role, line count (or a stub indicator), child
  SP count, parent SP count, and counts of referenced tables, views, and functions.
- **FR-017**: The detail panel MUST provide expandable sections for: child SPs (callees),
  parent SPs (callers), and "tables and other objects used" (non-SP referenced objects).
- **FR-018**: The "tables and other objects used" section MUST group items by `objectType`
  (`Table`, `View`, `Scalar Function`, `Table Function`, `Inline Function`,
  `OBJECT_OR_COLUMN`, `TYPE`) with the type name as a subheader and an item count.
- **FR-019**: Each SP name shown in the child-SPs or parent-SPs list MUST be clickable; a click
  MUST make that SP the new selection, re-center the canvas on it, and refresh the panel.
- **FR-020**: Empty lists (e.g., a leaf SP with no parents) MUST display an explicit empty-state
  message rather than a blank section.
- **FR-021**: Lists with more than 50 items MUST remain responsive (e.g., scrolling or
  virtualization) and MUST NOT block the UI thread when expanded.

**Data freshness**

- **FR-022**: The system MUST be designed so that edits to `data/mapeos_sp_grafo.json` are
  reflected after a plain page reload by the end user, with no manual rebuild step required.
  A backing process restart by the developer is an acceptable alternative path (either both
  paths are supported, or at minimum the user-reload path works).
- **FR-023**: If the data file is missing, unreadable, or fails to parse at load time, the
  system MUST show an explicit error state identifying the file and the failure reason
  (without exposing internal stack traces) instead of silently serving stale or empty data.
- **FR-024**: If the data file parses but fails the sanity checks documented in the data
  guide (counts mismatch, stubs without required shape), the system MUST show a non-blocking
  warning banner naming the inconsistency while still rendering the graph best-effort.

**Cross-cutting**

- **FR-025**: The UI MUST be a single-page web application — no multi-page navigation, no
  page refreshes triggered by in-app interactions.
- **FR-026**: The UI MUST follow a modern, minimalist visual language with no emojis in any
  visible string, icon, label, or message.
- **FR-027**: Every diagnostic emitted by the application (frontend and backing process) MUST
  flow through the centralized logger and follow the colored-prefix, dual-sink contract
  (terminal + log file) defined by the project constitution.
- **FR-028**: The system MUST handle the documented dataset characteristics — cycles,
  self-loops, dangling references, stubs, and duplicate edge encodings — without crashing,
  freezing, or visually corrupting the canvas.

### Key Entities

- **Stored Procedure (SP) node**: A single procedure from the source SQL Server.
  Identified by its name (case-sensitive). Attributes: role (`requerido`, `adjunto_hijo`,
  `adjunto_padre`, `adjunto_ambos`), line count (nullable for stubs), stub flag, in-degree and
  out-degree among SPs, optional module derived from name prefix (e.g., `PR_ERP_*`, `USP_*`).
- **SP→SP edge**: A directed "calls" relationship from one SP to another, derived from the
  dependency list filtered to `objectType == "Stored Procedure"` and deduplicated against the
  symmetric `callers` array.
- **Referenced non-SP object**: A table, view, scalar function, table function, inline
  function, unresolved `OBJECT_OR_COLUMN`, or type referenced by an SP. Identified by name +
  `objectType`. Not rendered as graph nodes by default; surfaced only in the detail panel for
  a selected SP.
- **Ghost reference**: A name appearing in some SP's `dependencies` or `callers` list that has
  no entry in `mappings` (a 1-hop boundary case). Rendered as a visually distinct node so the
  user knows it is outside the loaded dataset.
- **Stub SP**: An in-scope (`rol = "requerido"`) SP listed in
  `summary.faltantes_en_mapeos_sp` with `lines == null` and empty dependencies, indicating no
  metadata was available. Always rendered, always visually distinct.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Loading the app against the production data file produces a fully rendered
  overview of all ~3,704 SP nodes within 5 seconds on a typical broadband connection and a
  modern desktop browser (last-2-versions Chromium, Firefox, or Safari) on standard developer
  hardware.
- **SC-002**: Panning and zooming the canvas sustains an interactive frame rate of at least
  30 frames per second on the same reference hardware, with no perceptible freeze longer than
  300 milliseconds during continuous pan/zoom.
- **SC-003**: From the moment the user finishes typing a search term, the suggestion list
  appears within 200 milliseconds.
- **SC-004**: From clicking a search match (or a graph node) to the canvas finishing its
  re-center / highlight transition and the detail panel showing the SP's data is no more than
  1 second on the reference hardware.
- **SC-005**: 100% of SPs marked `rol = "requerido"` in the data file (currently 3,001) are
  rendered in the vivid in-scope color, and 100% of the remaining SPs are rendered in the
  muted palette, verifiable by visual inspection of the legend and a spot-check of any 10
  randomly chosen SP names from each role.
- **SC-006**: An edit to `data/mapeos_sp_grafo.json` (adding a node, removing a node, or
  changing an edge) is reflected in the rendered graph after a single plain browser reload —
  no manual rebuild, no manual cache flush, no developer intervention beyond an optional
  process restart.
- **SC-007**: Counts shown in the detail panel (child SPs, parent SPs, referenced tables,
  views, functions) match the corresponding counts derived directly from the data file for
  any selected SP, verifiable by spot-checking 5 SPs against a hand-computed count.
- **SC-008**: A malformed data file produces a visible, human-readable error message
  identifying the file and the failure within 2 seconds of page reload, instead of an
  indefinite blank screen or a silent stale render.

## Assumptions

- The data file at `data/mapeos_sp_grafo.json` is the single source of truth and is the
  canonical artifact used in development and any deployment of this tool. No other data
  source (a database, an API, an upload form) is in scope.
- Users access the app on standard developer hardware (laptop / desktop, modern browser,
  mouse or trackpad). Mobile and touchscreen support is nice-to-have but not a primary
  acceptance target.
- The graph is expected to grow or shrink modestly over time as the regenerator script reruns,
  but the order of magnitude stays around the current ~3.7k SP nodes and ~3k SP→SP edges. A
  10x increase in node count is out of scope for this feature.
- The app is intended for trusted internal use; no authentication, authorization, or
  multi-tenant isolation is in scope.
- Non-SP referenced objects (tables, views, functions, unresolved columns) appear only in the
  detail panel for a selected SP; they are not rendered as graph nodes by default. A future
  "show leaves" toggle is out of scope here.
- Modifications to the data file by the developer are assumed to be atomic at the filesystem
  level (e.g., editor writes via temp-file-then-rename). The system does not need to defend
  against torn writes beyond the parse-failure error path in FR-023.
- The visualization is read-only with respect to the data file. The app never writes back to
  `mapeos_sp_grafo.json`.
- Persistent state across page reloads (e.g., remembering the last selected SP, the last
  camera position, expanded panel sections) is out of scope for this feature.
- The "ghost" and "stub" visual conventions assume the dataset guide
  (`data/mapeos_sp_grafo.info.md`) accurately describes the file shape. If the guide and the
  file diverge in the future, FR-024's warning banner is the chosen recovery path.
