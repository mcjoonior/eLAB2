import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// GET /api/search?q=... - Globalne wyszukiwanie
// ============================================================

export const globalSearch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
    const q = rawQuery.trim();
    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limitNum = Math.min(10, Math.max(1, parseInt(limitParam || '5', 10) || 5));

    if (!q) {
      res.json({
        data: {
          clients: [],
          samples: [],
          analyses: [],
          processAnalyses: [],
        },
      });
      return;
    }

    const [clients, samples, analyses, processAnalyses] = await Promise.all([
      prisma.client.findMany({
        where: {
          OR: [
            { companyName: { contains: q, mode: 'insensitive' } },
            { nip: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limitNum,
        orderBy: { companyName: 'asc' },
        select: {
          id: true,
          companyName: true,
          nip: true,
          city: true,
        },
      }),
      prisma.sample.findMany({
        where: {
          OR: [
            { sampleCode: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { client: { companyName: { contains: q, mode: 'insensitive' } } },
            { process: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sampleCode: true,
          status: true,
          client: { select: { id: true, companyName: true } },
          process: { select: { id: true, name: true } },
        },
      }),
      prisma.analysis.findMany({
        where: {
          OR: [
            { analysisCode: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { sample: { sampleCode: { contains: q, mode: 'insensitive' } } },
            { sample: { client: { companyName: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          analysisCode: true,
          status: true,
          sample: {
            select: {
              id: true,
              sampleCode: true,
              client: { select: { id: true, companyName: true } },
              process: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.analysis.findMany({
        where: {
          sample: { process: { name: { contains: q, mode: 'insensitive' } } },
        },
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          analysisCode: true,
          status: true,
          sample: {
            select: {
              sampleCode: true,
              client: { select: { id: true, companyName: true } },
              process: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    res.json({
      data: {
        clients,
        samples,
        analyses,
        processAnalyses,
      },
    });
  } catch (error) {
    next(error);
  }
};
