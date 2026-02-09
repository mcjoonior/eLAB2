import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

export const globalSearch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { q, limit = '5' } = req.query as Record<string, string | undefined>;

    if (!q || q.length < 2) {
      res.status(400).json({ error: 'Parametr "q" musi miec co najmniej 2 znaki.' });
      return;
    }

    const limitNum = Math.min(10, Math.max(1, parseInt(limit as string, 10) || 5));

    const [clients, samples, analyses, processes] = await Promise.all([
      prisma.client.findMany({
        where: {
          isActive: true,
          OR: [
            { companyName: { contains: q, mode: 'insensitive' } },
            { nip: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limitNum,
        orderBy: { companyName: 'asc' },
        select: { id: true, companyName: true, nip: true, contactPerson: true, city: true },
      }),

      prisma.sample.findMany({
        where: {
          OR: [
            { sampleCode: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { client: { companyName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sampleCode: true,
          status: true,
          sampleType: true,
          client: { select: { id: true, companyName: true } },
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
          analysisDate: true,
          sample: {
            select: {
              id: true,
              sampleCode: true,
              client: { select: { companyName: true } },
              process: { select: { id: true, name: true } },
            },
          },
        },
      }),

      prisma.process.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limitNum,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, processType: true, description: true },
      }),
    ]);

    res.json({ clients, samples, analyses, processes });
  } catch (error) {
    next(error);
  }
};
