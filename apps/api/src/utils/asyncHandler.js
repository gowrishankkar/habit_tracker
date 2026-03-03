/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * the global error-handling middleware automatically.
 *
 * Without this, every async controller needs its own try/catch.
 * With it, controllers just throw — the errorHandler picks it up.
 *
 * @param {(req, res, next) => Promise<void>} fn
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
