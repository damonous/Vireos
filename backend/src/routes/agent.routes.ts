/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  processCommandSchema,
  listConversationsQuerySchema,
} from '../validators/agent.validators';
import * as agentService from '../services/agent';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
const auth = authenticate as any;

// Allowed roles: ADVISOR, ORG_ADMIN, SUPER_ADMIN (COMPLIANCE excluded — works in Boss Mode only)
const agentRoles = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;

// ---------------------------------------------------------------------------
// POST /command — Process a natural language command
// ---------------------------------------------------------------------------

router.post(
  '/command',
  auth,
  agentRoles,
  validateBody(processCommandSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await agentService.processCommand(req.body, authReq.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /conversations — List conversations
// ---------------------------------------------------------------------------

router.get(
  '/conversations',
  auth,
  agentRoles,
  validateQuery(listConversationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;
      const status = req.query['status'] as string | undefined;

      const result = await agentService.listConversations(authReq.user, {
        page,
        limit,
        status,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /conversations/:id — Get conversation detail
// ---------------------------------------------------------------------------

router.get(
  '/conversations/:id',
  auth,
  agentRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const conversationId = req.params['id'] as string;
      const conversation = await agentService.getConversation(conversationId, authReq.user);
      res.status(200).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /conversations/:id/archive — Archive a conversation
// ---------------------------------------------------------------------------

router.patch(
  '/conversations/:id/archive',
  auth,
  agentRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const conversationId = req.params['id'] as string;
      const conversation = await agentService.archiveConversation(conversationId, authReq.user);
      res.status(200).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
