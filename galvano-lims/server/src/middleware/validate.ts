import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Specifies which part(s) of the request should be validated.
 *   - body   – req.body   (default)
 *   - query  – req.query
 *   - params – req.params
 */
type RequestSource = 'body' | 'query' | 'params';

interface ValidateOptions {
  /**
   * Which request property to validate. Defaults to `'body'`.
   * Pass an array to validate multiple sources against the same schema
   * (rare, but possible for combined validation).
   */
  source?: RequestSource | RequestSource[];
}

// ---------------------------------------------------------------------------
// validate – Zod validation middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that validates the specified request source(s)
 * against the provided Zod schema.
 *
 * On success the parsed (and potentially transformed) data is written back to
 * the same request property so downstream handlers receive clean, typed data.
 *
 * On failure a 422 response with structured Polish error messages is returned.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { validate } from '../middleware/validate';
 *
 * const createClientSchema = z.object({
 *   companyName: z.string().min(1, 'Nazwa firmy jest wymagana'),
 *   nip: z.string().regex(/^\d{10}$/, 'NIP musi składać się z 10 cyfr').optional(),
 * });
 *
 * router.post('/', validate(createClientSchema), createClientHandler);
 * router.get('/', validate(paginationSchema, { source: 'query' }), listHandler);
 * ```
 */
export function validate(
  schema: ZodSchema,
  options: ValidateOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const { source = 'body' } = options;
  const sources: RequestSource[] = Array.isArray(source) ? source : [source];

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      for (const src of sources) {
        const parsed = schema.parse(req[src]);

        // Write parsed data back so handlers receive validated & transformed values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any)[src] = parsed;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((e) => ({
          pole: e.path.join('.') || '(root)',
          wiadomosc: e.message,
          kod: e.code,
        }));

        res.status(422).json({
          success: false,
          message: 'Błąd walidacji danych. Sprawdź przesłane pola.',
          errors: fieldErrors,
        });
        return;
      }

      // Unexpected error – forward to central error handler
      next(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/** Validate `req.body` against a Zod schema. */
export function validateBody(schema: ZodSchema) {
  return validate(schema, { source: 'body' });
}

/** Validate `req.query` against a Zod schema. */
export function validateQuery(schema: ZodSchema) {
  return validate(schema, { source: 'query' });
}

/** Validate `req.params` against a Zod schema. */
export function validateParams(schema: ZodSchema) {
  return validate(schema, { source: 'params' });
}
