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
// POST /command/stream — Process a command with SSE streaming
// ---------------------------------------------------------------------------

router.post(
  '/command/stream',
  auth,
  agentRoles,
  validateBody(processCommandSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      // Set SSE headers. Do not opt out of response transforms here:
      // compression's res.flush() support is what forces small HTTPS chunks through.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      // Disable Nagle's algorithm for immediate TCP delivery
      if (req.socket) {
        req.socket.setNoDelay(true);
      }
      res.flushHeaders();
      // Send an initial SSE comment to open the stream
      res.write(':ok\n\n');
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      let clientDisconnected = false;
      const markClientDisconnected = () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
        }
      };
      req.on('aborted', markClientDisconnected);
      res.on('close', markClientDisconnected);

      const emit = (event: import('../services/agent/types').SSEEvent) => {
        if (clientDisconnected) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // Flush through compression/TLS layers so the client receives data immediately
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      };

      await agentService.processCommandStream(req.body, authReq.user, emit);

      if (!clientDisconnected) {
        res.end();
      }
    } catch (err) {
      // If headers already sent, emit error event and end
      if (res.headersSent) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        res.write(`data: ${JSON.stringify({ event: 'error', message })}\n\n`);
        res.end();
      } else {
        next(err);
      }
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
