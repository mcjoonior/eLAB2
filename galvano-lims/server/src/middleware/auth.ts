import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../index';
import { AppError } from './errorHandler';

// ---------------------------------------------------------------------------
// JWT payload type
// ---------------------------------------------------------------------------

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Extend Express Request globally with authenticated user data
// ---------------------------------------------------------------------------

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// authenticateToken – verify Bearer access token and attach user to request
// ---------------------------------------------------------------------------

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Brak tokenu uwierzytelniającego. Zaloguj się, aby uzyskać dostęp.',
        401,
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Nieprawidłowy format nagłówka Authorization.', 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[Auth] Brak zmiennej środowiskowej JWT_SECRET.');
      throw new AppError('Błąd konfiguracji serwera.', 500, false);
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Verify the user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new AppError(
        'Użytkownik powiązany z tokenem nie istnieje.',
        401,
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Konto użytkownika zostało dezaktywowane. Skontaktuj się z administratorem.',
        403,
      );
    }

    // Attach user payload to the request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Nieprawidłowy token uwierzytelniający.', 401));
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      next(
        new AppError(
          'Token uwierzytelniający wygasł. Zaloguj się ponownie.',
          401,
        ),
      );
      return;
    }

    next(new AppError('Błąd weryfikacji tokenu uwierzytelniającego.', 401));
  }
}

// ---------------------------------------------------------------------------
// authorizeRoles – restrict access to specific user roles
// ---------------------------------------------------------------------------

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError(
          'Wymagane uwierzytelnienie. Najpierw zaloguj się.',
          401,
        ),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          'Brak uprawnień do wykonania tej operacji. Wymagana rola: ' +
            allowedRoles.join(', ') +
            '.',
          403,
        ),
      );
      return;
    }

    next();
  };
}
