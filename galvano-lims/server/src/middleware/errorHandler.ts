import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Custom application error
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Helper – translate common Prisma error codes to Polish messages
// ---------------------------------------------------------------------------

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  details?: unknown;
} {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[]) ?? [];
      return {
        statusCode: 409,
        message: `Rekord z podaną wartością już istnieje (pole: ${target.join(', ')}).`,
        details: { fields: target },
      };
    }
    case 'P2003':
      return {
        statusCode: 400,
        message: 'Powiązany rekord nie istnieje. Sprawdź poprawność identyfikatorów.',
      };
    case 'P2025':
      return {
        statusCode: 404,
        message: 'Nie znaleziono rekordu do aktualizacji lub usunięcia.',
      };
    case 'P2014':
      return {
        statusCode: 400,
        message: 'Operacja narusza wymagane powiązanie między rekordami.',
      };
    case 'P2016':
      return {
        statusCode: 400,
        message: 'Błąd interpretacji zapytania. Sprawdź przesłane dane.',
      };
    default:
      return {
        statusCode: 500,
        message: `Błąd bazy danych (kod: ${error.code}).`,
      };
  }
}

// ---------------------------------------------------------------------------
// Helper – format Zod validation errors into Polish-friendly structure
// ---------------------------------------------------------------------------

function handleZodError(error: ZodError): {
  statusCode: number;
  message: string;
  details: unknown;
} {
  const fieldErrors = error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));

  return {
    statusCode: 422,
    message: 'Błąd walidacji danych. Sprawdź przesłane pola.',
    details: { errors: fieldErrors },
  };
}

// ---------------------------------------------------------------------------
// Main error-handling middleware
// ---------------------------------------------------------------------------

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ---- Application errors (thrown intentionally) ----
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  // ---- Zod validation errors ----
  if (err instanceof ZodError) {
    const { statusCode, message, details } = handleZodError(err);
    res.status(statusCode).json({ success: false, message, details });
    return;
  }

  // ---- Prisma known request errors ----
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, message, details } = handlePrismaError(err);
    res.status(statusCode).json({
      success: false,
      message,
      ...(details !== undefined && { details }),
    });
    return;
  }

  // ---- Prisma validation errors ----
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'Błąd walidacji danych po stronie bazy danych. Sprawdź typy i wymagane pola.',
    });
    return;
  }

  // ---- JSON syntax errors (malformed request body) ----
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Nieprawidłowy format JSON w treści żądania.',
    });
    return;
  }

  // ---- JWT errors ----
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Nieprawidłowy token uwierzytelniający.',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token uwierzytelniający wygasł. Zaloguj się ponownie.',
    });
    return;
  }

  // ---- Fallback: unexpected / unhandled errors ----
  console.error('[ErrorHandler] Nieobsłużony błąd:', err);

  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: 'Wystąpił wewnętrzny błąd serwera. Spróbuj ponownie później.',
    ...(isDev && { stack: err.stack, originalMessage: err.message }),
  });
}
