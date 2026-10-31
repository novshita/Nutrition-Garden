/** Thin client for the backend API. Requests go through the Next.js rewrite at /api/v1. */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const NETWORK_MESSAGE = "We couldn't reach the garden right now. Please try again in a moment.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

type ValidationIssue = { loc?: unknown[]; msg?: string };

/** Turn the backend's `detail` (a string, or a list of validation issues) into one readable line. */
export function messageFromDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const issue = detail[0] as ValidationIssue;
    const field = issue.loc?.filter((part) => typeof part === "string").at(-1);
    const msg = issue.msg?.replace(/^Value error, /, "");
    if (msg) return field && field !== "body" ? `${String(field).replaceAll("_", " ")}: ${msg}` : msg;
  }
  return GENERIC_MESSAGE;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(response.status, messageFromDetail(detail));
  }
  return payload as T;
}
