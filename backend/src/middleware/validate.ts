import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Validation middleware factory
// ---------------------------------------------------------------------------

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Creates an Express middleware that validates the specified parts of the
 * request against provided Zod schemas.
 *
 * On success: replaces the validated portions of `req` with the parsed
 * (and coerced) values from Zod.
 *
 * On failure: calls `next(error)` with the raw `ZodError` — the global
 * `errorHandler` middleware will format it into a consistent 422 response.
 *
 * @example
 *   const schema = z.object({ email: z.string().email() });
 *   router.post('/users', validate({ body: schema }), createUserHandler);
 */
export function validate(schemas: ValidationTargets) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        // Express 5 makes req.query a read-only getter, so we must use
        // Object.defineProperty to override it with the parsed/coerced values.
        const parsedQuery = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(err);
      } else {
        next(err);
      }
    }
  };
}

/**
 * Convenience shorthand for body-only validation.
 *
 * @example
 *   router.post('/login', validateBody(loginSchema), loginHandler);
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Convenience shorthand for query-only validation.
 *
 * @example
 *   router.get('/posts', validateQuery(listQuerySchema), listHandler);
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Convenience shorthand for params-only validation.
 *
 * @example
 *   router.get('/posts/:id', validateParams(idParamSchema), getHandler);
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}
