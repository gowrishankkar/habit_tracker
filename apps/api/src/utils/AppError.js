/**
 * Typed application error that carries an HTTP status code.
 *
 * Throw this anywhere in service/repository code. The global errorHandler
 * middleware catches it and sends a standardized JSON response — no need
 * for try/catch in every controller.
 *
 * `isOperational` distinguishes expected business errors (bad input, not
 * found, auth failures) from unexpected crashes (null pointer, OOM).
 * Only operational errors expose their message to the client; non-operational
 * ones get a generic 500 in production.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.errors = options.errors;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // ── Convenience factories ────────────────────────────
  static badRequest(message, errors) {
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

  static conflict(message) {
    return new AppError(message, 409);
  }

  static validation(errors) {
    return new AppError("Validation failed", 422, { errors });
  }

  static internal(message = "Internal server error") {
    return new AppError(message, 500, { isOperational: false });
  }
}
