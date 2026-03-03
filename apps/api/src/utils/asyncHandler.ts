import type { Request, Response, NextFunction } from "express";

/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * the error-handling middleware automatically.
 *
 * Without this, every async controller needs its own try/catch.
 * With it, controllers just throw — the global errorHandler picks it up.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
