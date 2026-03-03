/**
 * Typed application error that carries an HTTP status code.
 *
 * Throw this anywhere in service/repository code. The global errorHandler
 * middleware catches it and sends a standardized JSON response — no need
 * for try/catch in every controller.
 *
 * `isOperational` distinguishes expected business errors (bad input, not
 * found) from unexpected crashes (null pointer, OOM). Only operational
 * errors expose their message to the client; non-operational ones get a
 * generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: string[];

  constructor(
    message: string,
    statusCode = 400,
    options?: { isOperational?: boolean; errors?: string[] },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.errors = options?.errors;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // ── Convenience factories ────────────────────────────
  static badRequest(message: string, errors?: string[]) {
    return new AppError(message, 400, { errors });
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }

  static notFound(message = "Resource not found") {
    return new AppError(message, 404);
  }

  static conflict(message: string) {
    return new AppError(message, 409);
  }

  static validation(errors: string[]) {
    return new AppError("Validation failed", 422, { errors });
  }

  static internal(message = "Internal server error") {
    return new AppError(message, 500, { isOperational: false });
  }
}
