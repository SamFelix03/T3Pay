export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function notFound(resource: string): AppError {
  return new AppError(404, "not_found", `${resource} not found`);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, "conflict", message, details);
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, "bad_request", message, details);
}

export function forbidden(message: string, details?: unknown): AppError {
  return new AppError(403, "forbidden", message, details);
}
