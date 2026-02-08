import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  getUserById,
} from '../services/authService';

// ============================================================
// SCHEMATY WALIDACJI ZOD
// ============================================================

const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email jest wymagany.' })
    .email('Nieprawidłowy format adresu email.'),
  password: z
    .string({ required_error: 'Hasło jest wymagane.' })
    .min(8, 'Hasło musi mieć co najmniej 8 znaków.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Hasło musi zawierać co najmniej: jedną małą literę, jedną wielką literę, jedną cyfrę i jeden znak specjalny.',
    ),
  firstName: z
    .string({ required_error: 'Imię jest wymagane.' })
    .min(2, 'Imię musi mieć co najmniej 2 znaki.')
    .max(50, 'Imię może mieć maksymalnie 50 znaków.'),
  lastName: z
    .string({ required_error: 'Nazwisko jest wymagane.' })
    .min(2, 'Nazwisko musi mieć co najmniej 2 znaki.')
    .max(50, 'Nazwisko może mieć maksymalnie 50 znaków.'),
  role: z
    .enum(['ADMIN', 'LABORANT', 'VIEWER'], {
      errorMap: () => ({
        message:
          'Nieprawidłowa rola. Dozwolone wartości: ADMIN, LABORANT, VIEWER.',
      }),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email jest wymagany.' })
    .email('Nieprawidłowy format adresu email.'),
  password: z
    .string({ required_error: 'Hasło jest wymagane.' })
    .min(1, 'Hasło jest wymagane.'),
});

// ============================================================
// STALE KONFIGURACJI COOKIE
// ============================================================

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

// ============================================================
// KONTROLERY
// ============================================================

/**
 * POST /api/auth/register
 * Rejestracja nowego uzytkownika (tylko admin).
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        'Błąd walidacji danych rejestracji.',
        422,
        true,
        {
          errors: parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      );
    }

    const user = await registerUser(parsed.data);

    res.status(201).json({
      success: true,
      message: 'Użytkownik został pomyślnie zarejestrowany.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Logowanie – zwraca access token w body i refresh token w httpOnly cookie.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        'Błąd walidacji danych logowania.',
        422,
        true,
        {
          errors: parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      );
    }

    const { user, tokens } = await loginUser(parsed.data);

    // Ustaw refresh token jako httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/api/auth',
    });

    res.json({
      success: true,
      message: 'Zalogowano pomyślnie.',
      data: {
        user,
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Odswiezenie access tokenu na podstawie refresh tokenu z cookie.
 */
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refreshToken: string | undefined =
      req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new AppError(
        'Brak refresh tokenu. Zaloguj się ponownie.',
        401,
      );
    }

    const { accessToken } = await refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Wylogowanie – usuniecie refresh tokenu (cookie).
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });

    res.json({
      success: true,
      message: 'Wylogowano pomyślnie.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Pobranie danych aktualnie zalogowanego uzytkownika.
 */
export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Brak autoryzacji.', 401);
    }

    const user = await getUserById(req.user.userId);

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}
