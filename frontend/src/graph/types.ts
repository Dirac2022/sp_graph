/**
 * Shared graph types mirroring the backend Pydantic schemas in
 * `backend/src/sp_graph_api/schemas.py`. Field names use camelCase across the
 * wire — see `specs/001-sp-graph-viewer/data-model.md` for prose context.
 */

/** Discriminator for an SP's role relative to the migration scope. */
export type SpRole =
  | "requerido"
  | "adjunto_hijo"
  | "adjunto_padre"
  | "adjunto_ambos";

/** Object types referenced by an SP that are not themselves SPs. */
export type LeafObjectType =
  | "Table"
  | "View"
  | "Scalar Function"
  | "Table Function"
  | "Inline Function"
  | "OBJECT_OR_COLUMN"
  | "TYPE";

/** A single stored procedure node in the graph. */
export interface SpNode {
  readonly id: string;
  readonly rol: SpRole;
  readonly lines: number | null;
  readonly isStub: boolean;
  readonly outDegreeSp: number;
  readonly inDegreeSp: number;
  readonly module?: string | null;
}

/** A directed "calls" edge between two SPs. */
export interface SpEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

/** A non-SP object referenced by some SP (table, view, function, etc.). */
export interface LeafRef {
  readonly name: string;
  readonly schema: string;
  readonly objectType: LeafObjectType;
}

/** Non-fatal sanity-check finding emitted by the loader. */
export interface GraphWarning {
  readonly code: string;
  readonly message: string;
}

/** Top-level metadata about the served payload. */
export interface GraphMeta {
  readonly dataFileMtimeIso: string;
  readonly dataFilePath: string;
  readonly totalEntries: number;
  readonly totalRequerido: number;
}

/** Full graph payload returned by `GET /api/graph`. */
export interface GraphData {
  readonly meta: GraphMeta;
  readonly nodes: ReadonlyArray<SpNode>;
  readonly edges: ReadonlyArray<SpEdge>;
  readonly ghosts: ReadonlyArray<string>;
  readonly leavesBySp: Readonly<Record<string, ReadonlyArray<LeafRef>>>;
  readonly warnings: ReadonlyArray<GraphWarning>;
}

/** Structured body returned by the API for fatal data-file errors. */
export interface ErrorBody {
  readonly code:
    | "data_file_unreadable"
    | "data_file_unparseable"
    | "data_file_shape_invalid";
  readonly message: string;
  readonly dataFilePath: string;
}

/** Envelope wrapping `ErrorBody`. */
export interface ErrorEnvelope {
  readonly error: ErrorBody;
}

/** A frontend-emitted log record forwarded to the backend. */
export interface LogPayload {
  readonly level: "WARNING" | "ERROR" | "CRITICAL";
  readonly module: string;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

/** A Magic program with its associated SP ids (mirrors backend ProgramEntry). */
export interface ProgramEntry {
  readonly num: number;
  readonly name: string;
  readonly spIds: ReadonlyArray<string>;
}

/** Full programs payload returned by `GET /api/programs`. */
export interface ProgramData {
  readonly programs: ReadonlyArray<ProgramEntry>;
  /** Map from SP id to the list of program numbers that use it. */
  readonly spToPrograms: Readonly<Record<string, ReadonlyArray<number>>>;
}

/** Per-selection derived shape consumed by the detail panel. */
export interface SpDetail {
  readonly id: string;
  readonly rol: SpRole;
  readonly lines: number | null;
  readonly isStub: boolean;
  readonly children: ReadonlyArray<string>;
  readonly parents: ReadonlyArray<string>;
  readonly leavesByType: Readonly<Record<LeafObjectType, ReadonlyArray<LeafRef>>>;
}
