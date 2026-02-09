import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  getSettings,
  updateSettings,
  handleUploadLogo,
  uploadLogo,
  testSmtp,
  getAuditLogs,
} from '../controllers/adminController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji + rola ADMIN
router.use(authenticateToken as any);
router.use(authorizeRoles('ADMIN') as any);

// ---- Zarzadzanie uzytkownikami ----

// GET /api/admin/users - Lista uzytkownikow
router.get('/users', getUsers as any);

// POST /api/admin/users - Utworzenie uzytkownika
router.post('/users', createUser as any);

// PUT /api/admin/users/:id - Aktualizacja uzytkownika
router.put('/users/:id', updateUser as any);

// PATCH /api/admin/users/:id/deactivate - Dezaktywacja/aktywacja uzytkownika
router.patch('/users/:id/deactivate', deactivateUser as any);

// ---- Ustawienia firmy ----

// GET /api/admin/settings - Pobranie ustawien
router.get('/settings', getSettings as any);

// PUT /api/admin/settings - Aktualizacja ustawien
router.put('/settings', updateSettings as any);

// POST /api/admin/settings/upload-logo - Upload logo firmy (multer)
router.post('/settings/upload-logo', uploadLogo.single('logo') as any, handleUploadLogo as any);

// POST /api/admin/settings/test-smtp - Test polaczenia SMTP
router.post('/settings/test-smtp', testSmtp as any);

// ---- Logi audytu ----

// GET /api/admin/audit-logs - Logi audytu z filtrami
router.get('/audit-logs', getAuditLogs as any);

export default router;
