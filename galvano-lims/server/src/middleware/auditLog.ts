import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  /** ID of the authenticated user performing the action (null for anonymous). */
  userId?: string | null;
  /** Short action verb, e.g. "CREATE", "UPDATE", "DELETE", "LOGIN", "APPROVE". */
  action: string;
  /** Entity/model name, e.g. "CLIENT", "SAMPLE", "ANALYSIS". */
  entityType: string;
  /** Primary key of the affected entity (optional). */
  entityId?: string | null;
  /** Arbitrary JSON details to store alongside the log entry. */
  details?: Record<string, unknown> | null;
  /** Client IP address (resolved automatically when used as middleware). */
  ipAddress?: string | null;
}

// ---------------------------------------------------------------------------
// createAuditLog – utility function for direct use in controllers/services
// ---------------------------------------------------------------------------

/**
 * Persists a single audit log entry to the `AuditLog` table.
 *
 * Use this from controllers or services when you need explicit control over
 * what gets logged (e.g. after a successful create/update/delete).
 *
 * The function is fire-and-forget by default -- it catches and logs errors
 * so that audit failures never break the main business flow.
 *
 * @example
 * ```ts
 * import { createAuditLog } from '../middleware/auditLog';
 *
 * await createAuditLog({
 *   userId: req.user?.userId,
 *   action: 'CREATE',
 *   entityType: 'CLIENT',
 *   entityId: newClient.id,
 *   details: { companyName: newClient.companyName },
 *   ipAddress: req.ip,
 * });
 * ```
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        details: entry.details ?? undefined,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Never let audit logging break the main request flow
    console.error('[AuditLog] Nie udało się zapisać wpisu audytu:', error);
  }
}

// ---------------------------------------------------------------------------
// createAuditLogFromRequest – convenience wrapper that extracts user & IP
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper around `createAuditLog` that automatically extracts
 * `userId` and `ipAddress` from an Express request object.
 *
 * @example
 * ```ts
 * await createAuditLogFromRequest(req, {
 *   action: 'UPDATE',
 *   entityType: 'SAMPLE',
 *   entityId: sample.id,
 *   details: { sampleCode: sample.sampleCode, changes: diff },
 * });
 * ```
 */
export async function createAuditLogFromRequest(
  req: Request,
  entry: Omit<AuditLogEntry, 'userId' | 'ipAddress'>,
): Promise<void> {
  await createAuditLog({
    ...entry,
    userId: req.user?.userId ?? null,
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
  });
}

// ---------------------------------------------------------------------------
// auditLogMiddleware – automatic audit logging as Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware factory that automatically logs an audit entry **after**
 * a successful response (status < 400). Attach it to individual routes that
 * should be audited.
 *
 * The middleware hooks into the `res.on('finish')` event so the log is
 * written only when the response has actually been sent.
 *
 * @param action     The action verb (e.g. `'CREATE'`, `'DELETE'`).
 * @param entityType The entity being acted upon (e.g. `'CLIENT'`).
 * @param options    Optional overrides / resolvers.
 *
 * @example
 * ```ts
 * import { auditLogMiddleware } from '../middleware/auditLog';
 *
 * router.delete(
 *   '/:id',
 *   authenticateToken,
 *   authorizeRoles('ADMIN'),
 *   auditLogMiddleware('DELETE', 'CLIENT', {
 *     entityIdFrom: 'params.id',
 *   }),
 *   deleteClientHandler,
 * );
 * ```
 */
export function auditLogMiddleware(
  action: string,
  entityType: string,
  options: {
    /** Dot-path in the request to resolve the entity ID, e.g. `'params.id'` or `'body.clientId'`. */
    entityIdFrom?: string;
    /** Static details object or a function that builds details from the request. */
    details?: Record<string, unknown> | ((req: Request) => Record<string, unknown>);
  } = {},
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Hook into the response finish event
    res.on('finish', () => {
      // Only log successful operations (2xx / 3xx)
      if (res.statusCode >= 400) return;

      let entityId: string | null = null;
      if (options.entityIdFrom) {
        const parts = options.entityIdFrom.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = req;
        for (const part of parts) {
          value = value?.[part];
        }
        if (typeof value === 'string') {
          entityId = value;
        }
      }

      const details =
        typeof options.details === 'function'
          ? options.details(req)
          : options.details ?? null;

      // Fire-and-forget
      createAuditLog({
        userId: req.user?.userId ?? null,
        action,
        entityType,
        entityId,
        details,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      });
    });

    next();
  };
}
