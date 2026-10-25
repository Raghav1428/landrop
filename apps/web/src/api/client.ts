import type { ApiError } from "@landrop/protocol";
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
let csrfToken = "";
export function setCsrf(token: string) {
  csrfToken = token;
}
export type Request = (
  method: string,
  path: string,
  body?: unknown,
  options?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<any>;
export const request: Request = async (method, path, body, options = {}) => {
  const binary = body instanceof Blob;
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      ...(body !== undefined
        ? {
            "Content-Type": binary
              ? "application/octet-stream"
              : "application/json",
          }
        : {}),
      ...(!["GET", "HEAD"].includes(method)
        ? { "X-CSRF-Token": csrfToken }
        : {}),
      ...options.headers,
    },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({
      error: {
        code: "UNAVAILABLE",
        message: `Request failed (${res.status})`,
        retryable: res.status >= 500,
      },
    }))) as ApiError;
    throw new RequestError(
      res.status,
      error.error.code,
      error.error.message,
      error.error.retryable,
    );
  }
  return res.json();
};
