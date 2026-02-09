import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { testSmtpConnection } from '../services/emailService';

// ============================================================
// Multer - upload logo
// ============================================================

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `logo_${Date.now()}${ext}`;
    cb(null, uniqueSuffix);
  },
});

const logoFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Niedozwolony format pliku. Dozwolone: PNG, JPG, JPEG, SVG, WEBP.'));
  }
};

export const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: logoFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ============================================================
// Walidacja Zod
// ============================================================

const createUserSchema = z.object({
  email: z
    .string({ required_error: 'Email jest wymagany.' })
    .email('Nieprawidlowy format adresu email.'),
  password: z
    .string({ required_error: 'Haslo jest wymagane.' })
    .min(8, 'Haslo musi miec co najmniej 8 znakow.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Haslo musi zawierac co najmniej: jedna mala litere, jedna wielka litere, jedna cyfre i jeden znak specjalny.',
    ),
  firstName: z
    .string({ required_error: 'Imie jest wymagane.' })
    .min(2, 'Imie musi miec co najmniej 2 znaki.'),
  lastName: z
    .string({ required_error: 'Nazwisko jest wymagane.' })
    .min(2, 'Nazwisko musi miec co najmniej 2 znaki.'),
  role: z
    .enum(['ADMIN', 'LABORANT', 'VIEWER'], {
      errorMap: () => ({
        message: 'Nieprawidlowa rola. Dozwolone wartosci: ADMIN, LABORANT, VIEWER.',
      }),
    })
    .optional()
    .default('LABORANT'),
});

const updateUserSchema = z.object({
  email: z.string().email('Nieprawidlowy format adresu email.').optional(),
  firstName: z.string().min(2, 'Imie musi miec co najmniej 2 znaki.').optional(),
  lastName: z.string().min(2, 'Nazwisko musi miec co najmniej 2 znaki.').optional(),
  role: z.enum(['ADMIN', 'LABORANT', 'VIEWER']).optional(),
  password: z
    .string()
    .min(8, 'Haslo musi miec co najmniej 8 znakow.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Haslo musi zawierac co najmniej: jedna mala litere, jedna wielka litere, jedna cyfre i jeden znak specjalny.',
    )
    .optional(),
});

const updateSettingsSchema = z.object({
  companyName: z.string().min(2, 'Nazwa firmy musi miec co najmniej 2 znaki.').optional(),
  appSubtitle: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  nip: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Nieprawidlowy adres e-mail.').optional().nullable(),
  website: z.string().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  smtpFrom: z.string().optional().nullable(),
  reportHeaderText: z.string().optional().nullable(),
  reportFooterText: z.string().optional().nullable(),
});

// ============================================================
// GET /users - Lista uzytkownikow
// ============================================================

export const getUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      role,
      isActive,
      page = '1',
      limit = '25',
      sortBy = 'lastName',
      sortOrder = 'asc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as any;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['firstName', 'lastName', 'email', 'role', 'createdAt'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'lastName';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              performedAnalyses: true,
              approvedAnalyses: true,
              generatedReports: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /users - Utworzenie uzytkownika
// ============================================================

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Sprawdz czy email jest unikalny
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Uzytkownik z podanym adresem email juz istnieje' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'USER',
        entityId: user.id,
        details: { email: user.email, role: user.role },
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /users/:id - Aktualizacja uzytkownika
// ============================================================

export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Uzytkownik nie zostal znaleziony' });
      return;
    }

    const data = validation.data;
    const updateData: any = {};

    if (data.email) {
      // Sprawdz czy email jest unikalny
      if (data.email !== existing.email) {
        const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
        if (duplicate) {
          res.status(409).json({ error: 'Uzytkownik z podanym adresem email juz istnieje' });
          return;
        }
      }
      updateData.email = data.email;
    }

    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.role) updateData.role = data.role;

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: user.id,
        details: { updatedFields: Object.keys(data).filter((k) => k !== 'password') },
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /users/:id/deactivate - Dezaktywacja uzytkownika
// ============================================================

export const deactivateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Uzytkownik nie zostal znaleziony' });
      return;
    }

    // Nie pozwol na dezaktywacje samego siebie
    if (id === req.user!.userId) {
      res.status(400).json({ error: 'Nie mozna dezaktywowac wlasnego konta' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: user.isActive ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'USER',
        entityId: user.id,
        details: { email: user.email, isActive: user.isActive },
      },
    });

    res.json({
      message: user.isActive
        ? `Uzytkownik ${user.firstName} ${user.lastName} zostal aktywowany`
        : `Uzytkownik ${user.firstName} ${user.lastName} zostal dezaktywowany`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /settings - Ustawienia firmy
// ============================================================

export const getSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.companySettings.findFirst();

    if (!settings) {
      // Utworz domyslne ustawienia
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Laboratorium Galwaniczne',
        },
      });
    }

    // Nie zwracaj hasla SMTP
    const { smtpPassword, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      smtpPasswordSet: !!smtpPassword,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /settings - Aktualizacja ustawien firmy
// ============================================================

export const updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Znajdz lub utworz ustawienia
    let settings = await prisma.companySettings.findFirst();

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: data.companyName ?? 'Laboratorium Galwaniczne',
          ...data,
        },
      });
    } else {
      // Jesli smtpPassword nie zostalo przeslane, nie nadpisuj
      const updateData: any = { ...data };
      if (updateData.smtpPassword === undefined || updateData.smtpPassword === null) {
        delete updateData.smtpPassword;
      }

      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'COMPANY_SETTINGS',
        entityId: settings.id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    // Nie zwracaj hasla SMTP
    const { smtpPassword, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      smtpPasswordSet: !!smtpPassword,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /settings/upload-logo - Upload logo firmy
// ============================================================

export const handleUploadLogo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nie przeslano pliku logo' });
      return;
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    let settings = await prisma.companySettings.findFirst();

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Laboratorium Galwaniczne',
          logoUrl,
        },
      });
    } else {
      // Usun stare logo jesli istnieje
      if (settings.logoUrl) {
        const oldPath = path.join(__dirname, '..', '..', settings.logoUrl);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // Ignoruj bledy usuwania starego pliku
          }
        }
      }

      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: { logoUrl },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPLOAD_LOGO',
        entityType: 'COMPANY_SETTINGS',
        entityId: settings.id,
        details: { logoUrl },
      },
    });

    res.json({
      message: 'Logo zostalo zaktualizowane',
      logoUrl,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /settings/test-smtp - Test polaczenia SMTP
// ============================================================

export const testSmtp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await testSmtpConnection();

    res.json({
      message: 'Polaczenie SMTP dziala prawidlowo',
      success: true,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || 'Nie udalo sie nawiazac polaczenia SMTP',
      success: false,
    });
  }
};

// ============================================================
// GET /audit-logs - Logi audytu z filtrami i paginacja
// ============================================================

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      action,
      entityType,
      userId,
      dateFrom,
      dateTo,
      search,
      page = '1',
      limit = '25',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action as string;
    }
    if (entityType) {
      where.entityType = entityType as string;
    }
    if (userId) {
      where.userId = userId as string;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search as string, mode: 'insensitive' } },
        { entityType: { contains: search as string, mode: 'insensitive' } },
        { entityId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: order },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
