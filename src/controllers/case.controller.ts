import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  listCases,
  getCaseByRef,
  createCase,
  patchCase,
  statsOverview,
  exportCasesCsv,
} from '../services/case.service.js';
import { HttpError } from '../utils/HttpError.js';

const listQuerySchema = z.object({
  status: z.string().optional(),
  district: z.string().optional(),
  search: z.string().optional(),
});

export const caseController = {
  exportCsv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const csv = await exportCasesCsv(
        req.user.role,
        req.user.id,
        userRow.district
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="malaria-cases-export.csv"'
      );
      res.send(csv);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const q = listQuerySchema.parse(req.query);
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const data = await listCases(
        req.user.role,
        req.user.id,
        userRow.district,
        q
      );
      res.json({ data: { cases: data } });
    } catch (e) {
      next(e);
    }
  },

  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const data = await statsOverview(
        req.user.role,
        req.user.id,
        userRow.district
      );
      res.json({ data });
    } catch (e) {
      next(e);
    }
  },

  getByRef: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const { caseRef } = req.params;
      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true },
      });
      const data = await getCaseByRef(
        caseRef,
        req.user.role,
        req.user.id,
        userRow.district
      );
      res.json({ data: { case: data } });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const reporter = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          phone: true,
          staffCode: true,
          district: true,
          role: true,
        },
      });
      const data = await createCase(req.body, reporter);
      res.status(201).json({ data: { case: data } });
    } catch (e) {
      next(e);
    }
  },

  patch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const { caseRef } = req.params;
      const reporter = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
        select: { district: true, name: true },
      });
      const data = await patchCase(
        caseRef,
        req.body,
        req.user.role,
        req.user.id,
        reporter.district,
        reporter.name
      );
      res.json({ data: { case: data } });
    } catch (e) {
      next(e);
    }
  },
};
