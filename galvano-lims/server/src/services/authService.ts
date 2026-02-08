import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { JwtPayload } from '../middleware/auth';

// ============================================================
// TYPY
// ============================================================

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// STALE
// ============================================================

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ============================================================
// SERWIS AUTORYZACJI
// ============================================================

/**
 * Rejestracja nowego uzytkownika.
 * Sprawdza unikalnosc emaila, hashuje haslo i tworzy rekord w bazie.
 */
export async function registerUser(input: RegisterInput): Promise<UserInfo> {
  const { email, password, firstName, lastName, role } = input;

  // Sprawdz czy email jest juz zajety
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError('Użytkownik z tym adresem email już istnieje.', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: role ?? UserRole.LABORANT,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Log audytu
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
      details: { email: user.email, role: user.role },
    },
  });

  return user;
}

/**
 * Logowanie – weryfikacja danych uwierzytelniajacych i generowanie tokenow.
 */
export async function loginUser(
  input: LoginInput,
): Promise<{ user: UserInfo; tokens: AuthTokens }> {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new AppError('Nieprawidłowy email lub hasło.', 401);
  }

  if (!user.isActive) {
    throw new AppError(
      'Konto użytkownika jest dezaktywowane. Skontaktuj się z administratorem.',
      403,
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Nieprawidłowy email lub hasło.', 401);
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const tokens = generateTokens(payload);

  // Log audytu
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: { method: 'password' },
    },
  });

  const userInfo: UserInfo = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { user: userInfo, tokens };
}

/**
 * Odswiezanie access tokenu na podstawie refresh tokenu.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string }> {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new AppError(
      'Brak konfiguracji JWT_REFRESH_SECRET.',
      500,
      false,
    );
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(
        'Refresh token wygasł. Zaloguj się ponownie.',
        401,
      );
    }
    throw new AppError('Nieprawidłowy refresh token.', 401);
  }

  // Sprawdz czy uzytkownik nadal istnieje i jest aktywny
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje.', 401);
  }

  if (!user.isActive) {
    throw new AppError(
      'Konto użytkownika zostało dezaktywowane.',
      403,
    );
  }

  const accessSecret = process.env.JWT_SECRET;
  if (!accessSecret) {
    throw new AppError('Brak konfiguracji JWT_SECRET.', 500, false);
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  return { accessToken };
}

/**
 * Pobranie danych uzytkownika po ID.
 */
export async function getUserById(userId: string): Promise<UserInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje.', 404);
  }

  return user;
}

// ============================================================
// FUNKCJE POMOCNICZE
// ============================================================

/**
 * Generowanie pary tokenow JWT (access + refresh).
 */
function generateTokens(payload: JwtPayload): AuthTokens {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new AppError(
      'Brak konfiguracji JWT_SECRET lub JWT_REFRESH_SECRET.',
      500,
      false,
    );
  }

  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
}
