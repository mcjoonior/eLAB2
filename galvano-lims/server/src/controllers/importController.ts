import { Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  parseFile,
  suggestColumnMappings,
  validateImportData,
  executeImport as executeImportService,
  rollbackImport as rollbackImportService,
  generateImportCode,
  getImportTemplates as getTemplatesService,
  createImportTemplate as createTemplateService,
  getImportJobs as getJobsService,
  getImportJobById as getJobByIdService,
} from '../services/importService';

// ============================================================
// Multer - upload plikow importu
// ============================================================

const importStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'imports');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `import_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueSuffix);
  },
});

const importFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.csv', '.tsv', '.xlsx', '.xls', '.json', '.xml'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Nieobslugiwany format pliku. Dozwolone: CSV, TSV, XLSX, XLS, JSON, XML.'));
  }
};

export const uploadImport = multer({
  storage: importStorage,
  fileFilter: importFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ============================================================
// Walidacja Zod
// ============================================================

const columnMappingSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: z.string().min(1),
  transformation: z.string().optional(),
  defaultValue: z.string().optional(),
});

const validateMappingSchema = z.object({
  importJobId: z.string().uuid('Nieprawidlowy identyfikator zadania importu'),
  importType: z.enum(['FULL', 'CLIENTS_ONLY', 'ANALYSES_ONLY', 'PROCESSES_ONLY', 'SAMPLES_ONLY']),
  columnMappings: z.array(columnMappingSchema).min(1, 'Wymagane jest co najmniej jedno mapowanie kolumn'),
  sourceSystem: z.string().optional(),
  enumMappings: z.record(z.record(z.string())).optional(),
  dateFormat: z.string().optional(),
  decimalSeparator: z.string().optional(),
  skipEmptyRows: z.boolean().optional(),
  deduplicateBy: z.string().optional(),
});

const executeImportSchema = z.object({
  importJobId: z.string().uuid('Nieprawidlowy identyfikator zadania importu'),
  mappingConfig: z.object({
    importType: z.enum(['FULL', 'CLIENTS_ONLY', 'ANALYSES_ONLY', 'PROCESSES_ONLY', 'SAMPLES_ONLY']),
    columnMappings: z.array(columnMappingSchema).min(1),
    sourceSystem: z.string().optional(),
    enumMappings: z.record(z.record(z.string())).optional(),
    dateFormat: z.string().optional(),
    decimalSeparator: z.string().optional(),
    skipEmptyRows: z.boolean().optional(),
    deduplicateBy: z.string().optional(),
  }),
});

const createTemplateSchema = z.object({
  name: z.string().min(2, 'Nazwa szablonu musi miec co najmniej 2 znaki'),
  description: z.string().optional().nullable(),
  mappingConfig: z.object({
    importType: z.enum(['FULL', 'CLIENTS_ONLY', 'ANALYSES_ONLY', 'PROCESSES_ONLY', 'SAMPLES_ONLY']),
    columnMappings: z.array(columnMappingSchema).min(1),
    sourceSystem: z.string().optional(),
    enumMappings: z.record(z.record(z.string())).optional(),
    dateFormat: z.string().optional(),
    decimalSeparator: z.string().optional(),
    skipEmptyRows: z.boolean().optional(),
    deduplicateBy: z.string().optional(),
  }),
  sourceSystem: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

// ============================================================
// POST /upload - Upload pliku
// ============================================================

export const handleUpload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nie przeslano pliku' });
      return;
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Parsuj plik
    const parsedFile = await parseFile(filePath, originalName);

    // Sugeruj mapowania kolumn
    const suggestions = suggestColumnMappings(parsedFile.headers);

    // Wygeneruj kod importu
    const importCode = await generateImportCode();

    // Utworz zadanie importu
    const importJob = await prisma.importJob.create({
      data: {
        importCode,
        importedBy: req.user!.userId,
        fileName: originalName,
        fileSize,
        totalRecords: parsedFile.totalRows,
        status: 'UPLOADED',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'IMPORT_UPLOAD',
        entityType: 'IMPORT_JOB',
        entityId: importJob.id,
        details: {
          fileName: originalName,
          fileSize,
          totalRows: parsedFile.totalRows,
          detectedEncoding: parsedFile.detectedEncoding,
        },
      },
    });

    res.status(201).json({
      importJob,
      file: {
        headers: parsedFile.headers,
        totalRows: parsedFile.totalRows,
        detectedEncoding: parsedFile.detectedEncoding,
        detectedSeparator: parsedFile.detectedSeparator,
        previewRows: parsedFile.rows.slice(0, 5),
      },
      suggestions,
      filePath, // potrzebne do nastepnych krokow
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /validate - Walidacja mapowania
// ============================================================

export const handleValidate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = validateMappingSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { importJobId, ...mappingConfig } = validation.data;

    // Pobierz zadanie importu
    const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!importJob) {
      res.status(404).json({ error: 'Zadanie importu nie zostalo znalezione' });
      return;
    }

    if (importJob.status !== 'UPLOADED' && importJob.status !== 'VALIDATION_FAILED') {
      res.status(400).json({
        error: `Nie mozna walidowac importu o statusie: ${importJob.status}`,
      });
      return;
    }

    // Zaktualizuj status na VALIDATING
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'VALIDATING',
        mappingConfig: mappingConfig as any,
        importType: mappingConfig.importType,
        sourceSystem: mappingConfig.sourceSystem,
      },
    });

    // Znajdz plik na dysku - szukaj po nazwie w katalogu importow
    const importDir = path.join(__dirname, '..', '..', 'uploads', 'imports');
    const files = fs.existsSync(importDir) ? fs.readdirSync(importDir) : [];

    // Parsuj plik ponownie
    let parsedRows: any[] = [];

    if (importJob.fileName) {
      // Szukaj pliku po nazwie - sprawdz czy istnieje plik odpowiadajacy temu jobowi
      // W uproszczeniu: znajdz najnowszy plik pasujacy do oczekiwanego rozszerzenia
      const ext = path.extname(importJob.fileName).toLowerCase();
      const matchingFiles = files
        .filter((f) => f.endsWith(ext))
        .map((f) => ({
          name: f,
          path: path.join(importDir, f),
          stat: fs.statSync(path.join(importDir, f)),
        }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

      if (matchingFiles.length > 0) {
        const parsed = await parseFile(matchingFiles[0].path, importJob.fileName);
        parsedRows = parsed.rows;
      }
    }

    if (parsedRows.length === 0) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: 'VALIDATION_FAILED' },
      });
      res.status(400).json({
        error: 'Nie mozna odczytac pliku importu. Przeslij plik ponownie.',
      });
      return;
    }

    // Wykonaj walidacje
    const report = await validateImportData(parsedRows, mappingConfig as any);

    // Zaktualizuj status na podstawie wynikow
    const hasErrors = report.errors.some((e) => e.severity === 'error');
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: hasErrors ? 'VALIDATION_FAILED' : 'UPLOADED', // Wracamy do UPLOADED - gotowe do wykonania
        validationErrors: report.errors.length > 0 ? report.errors as any : null,
      },
    });

    res.json({
      importJobId,
      validationReport: report,
      canExecute: !hasErrors,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /execute - Wykonanie importu
// ============================================================

export const handleExecute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = executeImportSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { importJobId, mappingConfig } = validation.data;

    // Pobierz zadanie importu
    const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!importJob) {
      res.status(404).json({ error: 'Zadanie importu nie zostalo znalezione' });
      return;
    }

    if (importJob.status !== 'UPLOADED') {
      res.status(400).json({
        error: `Nie mozna wykonac importu o statusie: ${importJob.status}. Wymagany status: UPLOADED`,
      });
      return;
    }

    // Parsuj plik ponownie
    const importDir = path.join(__dirname, '..', '..', 'uploads', 'imports');
    let parsedRows: any[] = [];

    if (importJob.fileName) {
      const ext = path.extname(importJob.fileName).toLowerCase();
      const files = fs.existsSync(importDir) ? fs.readdirSync(importDir) : [];
      const matchingFiles = files
        .filter((f) => f.endsWith(ext))
        .map((f) => ({
          name: f,
          path: path.join(importDir, f),
          stat: fs.statSync(path.join(importDir, f)),
        }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

      if (matchingFiles.length > 0) {
        const parsed = await parseFile(matchingFiles[0].path, importJob.fileName);
        parsedRows = parsed.rows;
      }
    }

    if (parsedRows.length === 0) {
      res.status(400).json({
        error: 'Nie mozna odczytac pliku importu. Przeslij plik ponownie.',
      });
      return;
    }

    // Zaktualizuj mapowanie w zadaniu
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        mappingConfig: mappingConfig as any,
        importType: mappingConfig.importType,
      },
    });

    // Wykonaj import
    const progress = await executeImportService(
      importJobId,
      parsedRows,
      mappingConfig as any,
      req.user!.userId
    );

    res.json({
      message: progress.errorRecords > 0
        ? `Import zakonczony czesciowo. Zaimportowano ${progress.importedRecords} z ${progress.totalRecords} rekordow.`
        : `Import zakonczony pomyslnie. Zaimportowano ${progress.importedRecords} rekordow.`,
      progress,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /jobs - Lista zadan importu
// ============================================================

export const getJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    const result = await getJobsService(pageNum, limitNum, status as any);

    res.json({
      data: result.jobs,
      pagination: {
        page: result.page,
        limit: limitNum,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /jobs/:id - Szczegoly zadania importu
// ============================================================

export const getJobById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const job = await getJobByIdService(id);
    res.json(job);
  } catch (error: any) {
    if (error.message?.includes('Nie znaleziono')) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
};

// ============================================================
// POST /jobs/:id/rollback - Wycofanie importu
// ============================================================

export const handleRollback = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await rollbackImportService(id, req.user!.userId);

    res.json({
      message: 'Import zostal wycofany pomyslnie',
      deleted: result.deleted,
    });
  } catch (error: any) {
    if (error.message?.includes('Nie znaleziono') || error.message?.includes('Nie mozna wycofac')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
};

// ============================================================
// GET /templates - Lista szablonow importu
// ============================================================

export const getTemplates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await getTemplatesService(req.user!.userId);
    res.json(templates);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /templates - Zapisanie szablonu importu
// ============================================================

export const createTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, description, mappingConfig, sourceSystem, isPublic } = validation.data;

    const template = await createTemplateService(
      name,
      description ?? null,
      mappingConfig as any,
      sourceSystem ?? null,
      isPublic,
      req.user!.userId
    );

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'IMPORT_TEMPLATE',
        entityId: template.id,
        details: { name, importType: mappingConfig.importType },
      },
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
};
