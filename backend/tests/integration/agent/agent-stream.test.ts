import compression from 'compression';
import express from 'express';
import request, { Response } from 'supertest';
import zlib from 'zlib';

const mockProcessCommandStream = jest.fn();

jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'advisor-user-id',
      orgId: 'test-org-id-1',
      role: 'ADVISOR',
      email: 'advisor@testorg.com',
    };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../src/middleware/validate', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
  validateQuery: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../src/services/agent', () => ({
  processCommand: jest.fn(),
  processCommandStream: (...args: any[]) => mockProcessCommandStream(...args),
  listConversations: jest.fn(),
  getConversation: jest.fn(),
  archiveConversation: jest.fn(),
}));

import router from '../../../src/routes/agent.routes';

function collectBuffer(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];

  res.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  res.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });

  res.on('error', (err) => {
    callback(err, Buffer.alloc(0));
  });
}

function decodeSseBody(response: Response): string {
  const rawBody = response.body as Buffer;

  if (response.headers['content-encoding'] === 'gzip') {
    try {
      return zlib.gunzipSync(rawBody).toString('utf8');
    } catch {
      return rawBody.toString('utf8');
    }
  }

  return rawBody.toString('utf8');
}

describe('POST /command/stream', () => {
  beforeEach(() => {
    mockProcessCommandStream.mockReset();
  });

  it('keeps SSE responses flush-capable over compression middleware', async () => {
    mockProcessCommandStream.mockImplementation(async (_dto, _user, emit) => {
      emit({ event: 'thinking' });
      emit({ event: 'text_delta', delta: 'hello' });
      emit({ event: 'done', assistantMessage: 'hello' });
    });

    const app = express();
    app.use(compression());
    app.use(express.json());
    app.use('/api/v1/agent', router);

    const response = await request(app)
      .post('/api/v1/agent/command/stream')
      .set('Accept-Encoding', 'gzip')
      .buffer(true)
      .parse(collectBuffer as any)
      .send({ command: 'Stream hello' });

    const body = decodeSseBody(response);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(body).toContain(':ok');
    expect(body).toContain('"event":"thinking"');
    expect(body).toContain('"event":"text_delta","delta":"hello"');
    expect(body).toContain('"event":"done","assistantMessage":"hello"');
  });
});
