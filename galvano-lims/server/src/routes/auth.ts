import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  register,
  login,
  refresh,
  logout,
  me,
} from '../controllers/authController';

const router = Router();

// POST /api/auth/register – rejestracja nowego uzytkownika (tylko admin)
router.post(
  '/register',
  authenticateToken,
  authorizeRoles('ADMIN'),
  register,
);

// POST /api/auth/login – logowanie (email + haslo)
router.post('/login', login);

// POST /api/auth/refresh – odswiezenie access tokenu (refresh token z cookie)
router.post('/refresh', refresh);

// POST /api/auth/logout – wylogowanie (usun refresh token cookie)
router.post('/logout', authenticateToken, logout);

// GET /api/auth/me – dane aktualnie zalogowanego uzytkownika
router.get('/me', authenticateToken, me);

export default router;
