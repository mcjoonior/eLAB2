import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { globalSearch } from '../controllers/searchController';

const router = Router();

router.use(authenticateToken as any);

// GET /api/search?q=... - globalne wyszukiwanie
router.get('/', globalSearch as any);

export default router;
