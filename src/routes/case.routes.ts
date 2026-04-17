import { Router } from 'express';
import { caseController } from '../controllers/case.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validate.js';
import { createCaseSchema, patchCaseSchema } from '../validators/case.schemas.js';

export const caseRouter = Router();

caseRouter.use(authenticate);

caseRouter.get('/stats', caseController.stats);
caseRouter.get('/export', caseController.exportCsv);
caseRouter.get('/', caseController.list);
caseRouter.get('/:caseRef', caseController.getByRef);
caseRouter.post(
  '/',
  requireRole('CHW', 'HEALTH_CENTER', 'LOCAL_CLINIC'),
  validateBody(createCaseSchema),
  caseController.create
);
caseRouter.patch(
  '/:caseRef',
  validateBody(patchCaseSchema),
  caseController.patch
);
