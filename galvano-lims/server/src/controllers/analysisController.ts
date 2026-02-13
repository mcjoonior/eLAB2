import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// Walidacja Zod
// ============================================================

const createAnalysisSchema = z.object({
  sampleId: z.string().uuid('Nieprawidlowy identyfikator probki'),
  analysisType: z.enum(['CHEMICAL', 'CORROSION_TEST', 'SURFACE_ANALYSIS']).optional().default('CHEMICAL'),
  analysisDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateAnalysisSchema = z.object({
  analysisType: z.enum(['CHEMICAL', 'CORROSION_TEST', 'SURFACE_ANALYSIS']).optional(),
  analysisDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const changeStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']),
});

const saveResultSchema = z.object({
  parameterName: z.string().min(1, 'Nazwa parametru jest wymagana'),
  unit: z.string().min(1, 'Jednostka jest wymagana'),
  value: z.number({ required_error: 'Wartosc jest wymagana' }),
  minReference: z.number().optional().nullable(),
  maxReference: z.number().optional().nullable(),
  optimalReference: z.number().optional().nullable(),
});

const addRecommendationSchema = z.object({
  parameterName: z.string().min(1, 'Nazwa parametru jest wymagana'),
  description: z.string().min(1, 'Opis zalecenia jest wymagany'),
  recommendationType: z.enum(['INCREASE', 'DECREASE', 'MAINTAIN', 'URGENT_ACTION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  currentValue: z.number().optional().nullable(),
  targetValue: z.number().optional().nullable(),
});

// ============================================================
// Generowanie kodu analizy: ANL-YYYYMM-XXXX
// ============================================================

async function generateAnalysisCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `ANL-${yearMonth}-`;

  const lastAnalysis = await prisma.analysis.findFirst({
    where: {
      analysisCode: { startsWith: prefix },
    },
    orderBy: { analysisCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastAnalysis) {
    const lastNumber = parseInt(lastAnalysis.analysisCode.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// ============================================================
// Obliczanie odchylenia od zakresu referencyjnego
// ============================================================

function calculateDeviation(
  value: number,
  min: number | null,
  max: number | null,
  optimal: number | null
): { deviation: string; deviationPercent: number } {
  if (min != null && value < min) {
    const range = (max ?? min) - min;
    const diff = min - value;
    const pct = range > 0 ? (diff / range) * 100 : 0;
    return pct > 20
      ? { deviation: 'CRITICAL_LOW', deviationPercent: -pct }
      : { deviation: 'BELOW_MIN', deviationPercent: -pct };
  }
  if (max != null && value > max) {
    const range = max - (min ?? max);
    const diff = value - max;
    const pct = range > 0 ? (diff / range) * 100 : 0;
    return pct > 20
      ? { deviation: 'CRITICAL_HIGH', deviationPercent: pct }
      : { deviation: 'ABOVE_MAX', deviationPercent: pct };
  }
  return {
    deviation: 'WITHIN_RANGE',
    deviationPercent: optimal ? ((value - optimal) / optimal) * 100 : 0,
  };
}

// ============================================================
// GET / - Lista analiz z filtrami
// ============================================================

export const getAnalyses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      sampleId,
      dateFrom,
      dateTo,
      search,
      page = '1',
      limit = '25',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.AnalysisWhereInput = {};

    if (status) {
      where.status = status as any;
    }
    if (sampleId) {
      where.sampleId = sampleId as string;
    }

    // Filtry dat
    if (dateFrom || dateTo) {
      where.analysisDate = {};
      if (dateFrom) {
        where.analysisDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.analysisDate.lte = new Date(dateTo as string);
      }
    }

    // Wyszukiwanie
    if (search) {
      where.OR = [
        { analysisCode: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
        { sample: { sampleCode: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const allowedSortFields = ['analysisCode', 'analysisDate', 'createdAt', 'status'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          sample: {
            select: {
              id: true,
              sampleCode: true,
              sampleType: true,
              client: { select: { id: true, companyName: true } },
              process: { select: { id: true, name: true, processType: true } },
            },
          },
          performer: { select: { id: true, firstName: true, lastName: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { results: true, recommendations: true } },
        },
      }),
      prisma.analysis.count({ where }),
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
// GET /:id - Szczegoly analizy z wynikami, zaleceniami, probka, procesem
// ============================================================

export const getAnalysisById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        sample: {
          include: {
            client: {
              select: { id: true, companyName: true, contactPerson: true, email: true, phone: true },
            },
            process: {
              include: {
                parameters: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        results: { orderBy: { createdAt: 'asc' } },
        recommendations: {
          orderBy: { priority: 'desc' },
          include: {
            creator: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          select: { id: true, reportCode: true, generatedAt: true, sentToClient: true },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    res.json(analysis);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST / - Utworzenie analizy z automatycznym kodem
// ============================================================

export const createAnalysis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createAnalysisSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Sprawdz czy probka istnieje
    const sample = await prisma.sample.findUnique({ where: { id: data.sampleId } });
    if (!sample) {
      res.status(404).json({ error: 'Probka nie zostala znaleziona' });
      return;
    }

    const analysisCode = await generateAnalysisCode();

    const analysis = await prisma.analysis.create({
      data: {
        analysisCode,
        sampleId: data.sampleId,
        performedBy: req.user!.userId,
        analysisType: data.analysisType as any,
        analysisDate: data.analysisDate ? new Date(data.analysisDate) : new Date(),
        notes: data.notes,
        status: 'PENDING',
      },
      include: {
        sample: {
          select: {
            id: true,
            sampleCode: true,
            client: { select: { id: true, companyName: true } },
            process: { select: { id: true, name: true, processType: true } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Jesli probka jest w statusie REGISTERED, przesun do IN_PROGRESS
    if (sample.status === 'REGISTERED') {
      await prisma.sample.update({
        where: { id: sample.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'ANALYSIS',
        entityId: analysis.id,
        details: { analysisCode: analysis.analysisCode, sampleCode: sample.sampleCode },
      },
    });

    res.status(201).json(analysis);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /:id - Aktualizacja analizy
// ============================================================

export const updateAnalysis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = updateAnalysisSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.analysis.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    if (existing.status === 'APPROVED') {
      res.status(400).json({ error: 'Nie mozna edytowac zatwierdzonej analizy' });
      return;
    }

    const data = validation.data;
    const updateData: any = { ...data };
    if (data.analysisDate) {
      updateData.analysisDate = new Date(data.analysisDate);
    }

    const analysis = await prisma.analysis.update({
      where: { id },
      data: updateData,
      include: {
        sample: {
          select: {
            id: true,
            sampleCode: true,
            client: { select: { id: true, companyName: true } },
            process: { select: { id: true, name: true, processType: true } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'ANALYSIS',
        entityId: id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /:id/status - Zmiana statusu analizy (workflow)
// ============================================================

export const changeAnalysisStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = changeStatusSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { status: newStatus } = validation.data;

    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    // Walidacja workflow statusow
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED', 'REJECTED'],
      COMPLETED: ['APPROVED', 'REJECTED'],
      APPROVED: [], // status koncowy
      REJECTED: ['IN_PROGRESS'], // mozna wrocic do pracy
    };

    const allowed = allowedTransitions[analysis.status] || [];
    if (!allowed.includes(newStatus)) {
      res.status(400).json({
        error: `Niedozwolona zmiana statusu z "${analysis.status}" na "${newStatus}"`,
        allowedTransitions: allowed,
      });
      return;
    }

    const updated = await prisma.analysis.update({
      where: { id },
      data: { status: newStatus },
      include: {
        sample: {
          select: { id: true, sampleCode: true },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'ANALYSIS',
        entityId: id,
        details: {
          analysisCode: analysis.analysisCode,
          previousStatus: analysis.status,
          newStatus,
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /:id/approve - Zatwierdzenie analizy (tylko ADMIN)
// ============================================================

export const approveAnalysis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis: any = await prisma.analysis.findUnique({
      where: { id },
      include: {
        results: true,
      },
    });

    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    if (analysis.status !== 'COMPLETED') {
      res.status(400).json({
        error: 'Tylko analize o statusie "COMPLETED" mozna zatwierdzic',
        currentStatus: analysis.status,
      });
      return;
    }

    if (analysis.results.length === 0) {
      res.status(400).json({
        error: 'Nie mozna zatwierdzic analizy bez wynikow',
      });
      return;
    }

    const updated = await prisma.analysis.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.userId,
        approvedAt: new Date(),
      },
      include: {
        sample: {
          select: {
            id: true,
            sampleCode: true,
            client: { select: { id: true, companyName: true } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'APPROVE',
        entityType: 'ANALYSIS',
        entityId: id,
        details: {
          analysisCode: analysis.analysisCode,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    // Utworz powiadomienie dla wykonujacego analize
    if (analysis.performedBy !== req.user!.userId) {
      await prisma.notification.create({
        data: {
          userId: analysis.performedBy,
          title: 'Analiza zatwierdzona',
          message: `Analiza ${analysis.analysisCode} zostala zatwierdzona.`,
          type: 'success',
          link: `/analyses/${analysis.id}`,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /:id/results - Zapisanie wynikow analizy
// ============================================================

export const saveAnalysisResults = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    if (analysis.status === 'APPROVED') {
      res.status(400).json({ error: 'Nie mozna modyfikowac wynikow zatwierdzonej analizy' });
      return;
    }

    // Walidacja tablicy wynikow
    const resultsArray = z.array(saveResultSchema).safeParse(req.body);
    if (!resultsArray.success) {
      res.status(400).json({
        error: 'Blad walidacji wynikow',
        details: resultsArray.error.flatten(),
      });
      return;
    }

    const results = resultsArray.data;

    // Usun istniejace wyniki i zapisz nowe w transakcji
    const savedResults = await prisma.$transaction(async (tx) => {
      await tx.analysisResult.deleteMany({ where: { analysisId: id } });

      const created = [];
      for (const result of results) {
        const { deviation, deviationPercent } = calculateDeviation(
          result.value,
          result.minReference ?? null,
          result.maxReference ?? null,
          result.optimalReference ?? null
        );

        const saved = await tx.analysisResult.create({
          data: {
            analysisId: id,
            parameterName: result.parameterName,
            unit: result.unit,
            value: new Prisma.Decimal(result.value),
            minReference: result.minReference != null ? new Prisma.Decimal(result.minReference) : null,
            maxReference: result.maxReference != null ? new Prisma.Decimal(result.maxReference) : null,
            optimalReference: result.optimalReference != null ? new Prisma.Decimal(result.optimalReference) : null,
            deviation: deviation as any,
            deviationPercent: new Prisma.Decimal(deviationPercent),
          },
        });
        created.push(saved);
      }

      // Przesun status analizy do IN_PROGRESS jesli PENDING
      if (analysis.status === 'PENDING') {
        await tx.analysis.update({
          where: { id },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return created;
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'SAVE_RESULTS',
        entityType: 'ANALYSIS',
        entityId: id,
        details: {
          analysisCode: analysis.analysisCode,
          resultsCount: savedResults.length,
        },
      },
    });

    res.json({
      message: `Zapisano ${savedResults.length} wynikow analizy`,
      results: savedResults,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /:id/recommendations - Dodanie zalecenia
// ============================================================

export const addRecommendation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    const validation = addRecommendationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    const recommendation = await prisma.recommendation.create({
      data: {
        analysisId: id,
        parameterName: data.parameterName,
        description: data.description,
        recommendationType: data.recommendationType,
        priority: data.priority,
        currentValue: data.currentValue != null ? new Prisma.Decimal(data.currentValue) : null,
        targetValue: data.targetValue != null ? new Prisma.Decimal(data.targetValue) : null,
        createdBy: req.user!.userId,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'RECOMMENDATION',
        entityId: recommendation.id,
        details: {
          analysisCode: analysis.analysisCode,
          parameterName: data.parameterName,
          priority: data.priority,
        },
      },
    });

    // Jesli priorytet CRITICAL - utworz powiadomienie
    if (data.priority === 'CRITICAL') {
      // Powiadom wszystkich adminow
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'Krytyczne zalecenie',
            message: `Dodano krytyczne zalecenie dla parametru "${data.parameterName}" w analizie ${analysis.analysisCode}.`,
            type: 'error',
            link: `/analyses/${analysis.id}`,
          },
        });
      }
    }

    res.status(201).json(recommendation);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /:id/recommendations - Pobranie zalecen analizy
// ============================================================

export const getRecommendations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    const recommendations = await prisma.recommendation.findMany({
      where: { analysisId: id },
      orderBy: { priority: 'desc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(recommendations);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Multer config for analysis attachments
// ============================================================

const ATTACHMENTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'attachments');
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `att_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

export const uploadAttachments = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Niedozwolony typ pliku: ${ext}. Dozwolone: ${allowed.join(', ')}`));
    }
  },
});

// ============================================================
// POST /:id/attachments - Upload zdjec do analizy
// ============================================================

export const addAttachments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Nie przeslano zadnych plikow' });
      return;
    }

    const description = (req.body.description as string) || undefined;

    const attachments = await Promise.all(
      files.map((file) =>
        prisma.analysisAttachment.create({
          data: {
            analysisId: id,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            description,
          },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPLOAD_ATTACHMENT',
        entityType: 'ANALYSIS',
        entityId: id,
        details: { count: attachments.length, filenames: attachments.map((a) => a.originalName) },
      },
    });

    res.status(201).json(attachments);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /:id/attachments/:attachmentId - Usun zalacznik
// ============================================================

export const deleteAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id, attachmentId } = req.params;

    const attachment = await prisma.analysisAttachment.findFirst({
      where: { id: attachmentId, analysisId: id },
    });

    if (!attachment) {
      res.status(404).json({ error: 'Zalacznik nie zostal znaleziony' });
      return;
    }

    // Delete file from disk
    const filePath = path.join(ATTACHMENTS_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.analysisAttachment.delete({ where: { id: attachmentId } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE_ATTACHMENT',
        entityType: 'ANALYSIS',
        entityId: id,
        details: { filename: attachment.originalName },
      },
    });

    res.json({ message: 'Zalacznik zostal usuniety' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /:id - Usuniecie analizy (tylko ADMIN)
// ============================================================

export const deleteAnalysis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.analysis.findUnique({
      where: { id },
      include: {
        reports: {
          select: {
            id: true,
            pdfPath: true,
          },
        },
        attachments: {
          select: {
            filename: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    const reportFiles = existing.reports.map((r) => r.pdfPath).filter(Boolean) as string[];
    const attachmentFiles = existing.attachments.map((a) => a.filename);

    await prisma.$transaction(async (tx) => {
      await tx.report.deleteMany({ where: { analysisId: id } });
      await tx.analysis.delete({ where: { id } });

      const remainingAnalyses = await tx.analysis.count({ where: { sampleId: existing.sampleId } });
      if (remainingAnalyses === 0) {
        await tx.sample.updateMany({
          where: { id: existing.sampleId, status: 'IN_PROGRESS' },
          data: { status: 'REGISTERED' },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'DELETE',
          entityType: 'ANALYSIS',
          entityId: existing.id,
          details: {
            analysisCode: existing.analysisCode,
            removedReports: existing.reports.length,
            removedAttachments: existing.attachments.length,
          },
        },
      });
    });

    for (const filePath of reportFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore file delete errors.
        }
      }
    }

    for (const filename of attachmentFiles) {
      const fullPath = path.join(ATTACHMENTS_DIR, filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Ignore file delete errors.
        }
      }
    }

    res.json({
      message: `Analiza ${existing.analysisCode} zostala usunieta`,
    });
  } catch (error) {
    next(error);
  }
};
