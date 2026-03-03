import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError.js";

/**
 * Factory that returns middleware validating `req.body` against a Zod schema.
 * Keeps controllers free from validation logic.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      );
      throw AppError.validation(errors);
    }
    req.body = result.data;
    next();
  };
}
