/**
 * Typed HTTP client for the SP Graph API.
 *
 * Two endpoints are exposed:
 *
 * - `fetchGraph()` returns a {@link GraphData} payload or throws an `ApiError`
 *   carrying the `ErrorEnvelope` body on non-200 responses.
 * - `postLog()` forwards a {@link LogPayload} record; it is fire-and-forget and
 *   never throws into the caller.
 */

import type { ErrorEnvelope, GraphData, LogPayload } from "../graph/types";

/** Error thrown by `fetchGraph` when the API returns a non-200 response. */
export class ApiError extends Error {
  /** HTTP status code. */
  readonly status: number;

  /** Structured error envelope if the response body matched the contract. */
  readonly envelope: ErrorEnvelope | null;

  constructor(status: number, message: string, envelope: ErrorEnvelope | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.envelope = envelope;
  }
}

/**
 * Fetch the full graph payload.
 *
 * @throws ApiError on non-200 responses; consumers should render the
 *         `envelope.error` in the ErrorBanner.
 */
export const fetchGraph = async (): Promise<GraphData> => {
  const response = await fetch("/api/graph", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let envelope: ErrorEnvelope | null = null;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = null;
    }
    const msg = envelope?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(response.status, msg, envelope);
  }
  return (await response.json()) as GraphData;
};

/**
 * Forward a log record to the backend. Fire-and-forget: any network or status
 * failure is swallowed so the caller never crashes.
 */
export const postLog = (payload: LogPayload): void => {
  void fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // intentional silence
  });
};
