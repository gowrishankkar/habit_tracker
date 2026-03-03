import { AppError } from "../utils/AppError.js";

/**
 * Factory: returns middleware that validates `req.body` against a Zod schema.
 *
 * On success, `req.body` is replaced with the parsed (coerced + stripped)
 * value so downstream handlers always receive clean data.
 * On failure, delegates to the global errorHandler via next().
 *
 * @param {import('zod').ZodSchema} schema
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      return next(AppError.validation(errors));
    }
    req.body = result.data;
    next();
  };
}
