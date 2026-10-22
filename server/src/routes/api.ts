import { Router, Request, Response } from 'express';
import { store } from '../services/store.js';
import { runSingleCheck } from '../services/checker.js';
import {
  CreateMonitorDTO,
  UpdateMonitorDTO,
  WebhookPayloadLog,
} from '../types/monitor.js';

const router = Router();

// GET /api/monitors - List all monitors
router.get('/monitors', (_req: Request, res: Response): void => {
  try {
    const monitors = store.getAllMonitors();
    res.json(monitors);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/monitors/:id - Get monitor by ID
router.get('/monitors/:id', (req: Request, res: Response): void => {
  try {
    const monitor = store.getMonitorById(req.params.id);
    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }
    res.json(monitor);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/monitors - Create new monitor
router.post('/monitors', async (req: Request, res: Response): Promise<void> => {
  try {
    const body: CreateMonitorDTO = req.body;

    if (!body.name || !body.url) {
      res.status(400).json({ error: 'Name and URL are required' });
      return;
    }

    try {
      new URL(body.url);
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    const newMonitor = store.createMonitor(body);
    
    // Trigger initial health check asynchronously
    runSingleCheck(newMonitor.id).catch((err) => {
      console.error(`Initial check failed for monitor ${newMonitor.id}:`, err);
    });

    res.status(201).json(newMonitor);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/monitors/:id - Update monitor
router.put('/monitors/:id', (req: Request, res: Response): void => {
  try {
    const body: UpdateMonitorDTO = req.body;
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
      }
    }

    const updated = store.updateMonitor(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/monitors/:id - Delete monitor
router.delete('/monitors/:id', (req: Request, res: Response): void => {
  try {
    const deleted = store.deleteMonitor(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/monitors/:id/check - Trigger immediate manual health check
router.post('/monitors/:id/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const monitor = store.getMonitorById(req.params.id);
    if (!monitor) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }

    const checkResult = await runSingleCheck(req.params.id);
    res.json(checkResult);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/webhook/test - Ingestion endpoint for webhook testing and payload inspection
router.all('/webhook/test', (req: Request, res: Response): void => {
  try {
    const headersRecord: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headersRecord[key] = value.join(', ');
      } else if (value !== undefined) {
        headersRecord[key] = value;
      }
    }

    const logEntry: WebhookPayloadLog = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      receivedAt: new Date().toISOString(),
      method: req.method,
      headers: headersRecord,
      queryParams: req.query as Record<string, string>,
      body: req.body,
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
    };

    store.saveWebhookLog(logEntry);

    res.status(200).json({
      success: true,
      message: 'Webhook payload captured successfully',
      capturedId: logEntry.id,
      timestamp: logEntry.receivedAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/webhook/logs - Retrieve captured webhook logs
router.get('/webhook/logs', (_req: Request, res: Response): void => {
  try {
    const logs = store.getWebhookLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/webhook/logs - Clear captured webhook logs
router.delete('/webhook/logs', (_req: Request, res: Response): void => {
  try {
    store.clearWebhookLogs();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;