import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma, redis, io } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import fs from 'fs';
// In backend/src/index.ts
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Get all webinars (admin view - includes all statuses)
router.get('/webinars', async (req: AuthRequest, res: Response) => {
  try {
    const webinars = await prisma.webinar.findMany({
      include: {
        host: {
          select: { name: true, email: true },
        },
        state: true,
        _count: {
          select: { registrations: true, chatMessages: true, automations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ webinars });
  } catch (error) {
    console.error('Get admin webinars error:', error);
    res.status(500).json({ error: 'Failed to fetch webinars' });
  }
});

// Get webinar registrations
router.get('/webinars/:id/registrations', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const registrations = await prisma.registration.findMany({
      where: { webinarId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ registrations });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Start webinar
router.post('/webinars/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const webinar = await prisma.webinar.update({
      where: { id },
      data: {
        status: 'LIVE',
        state: {
          update: {
            isLive: true,
            startedAt: new Date(),
            currentTimestamp: 0,
          },
        },
      },
      include: { state: true },
    });

    // Store state in Redis for real-time sync
    await redis.set(`webinar:${id}:state`, JSON.stringify({
      isLive: true,
      startedAt: new Date().toISOString(),
      currentTimestamp: 0,
    }));

    // Notify all connected clients
    io.to(`webinar:${id}`).emit('webinar:started', {
      webinarId: id,
      startedAt: new Date().toISOString(),
    });

    // Log action
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        webinarId: id,
        action: 'WEBINAR_STARTED',
      },
    });

    res.json({ webinar, message: 'Webinar started' });
  } catch (error) {
    console.error('Start webinar error:', error);
    res.status(500).json({ error: 'Failed to start webinar' });
  }
});

// Stop webinar
router.post('/webinars/:id/stop', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const webinar = await prisma.webinar.update({
      where: { id },
      data: {
        status: 'ENDED',
        state: {
          update: {
            isLive: false,
            endedAt: new Date(),
          },
        },
      },
      include: { state: true },
    });

    // Clear Redis state
    await redis.del(`webinar:${id}:state`);

    // Notify all connected clients
    io.to(`webinar:${id}`).emit('webinar:ended', {
      webinarId: id,
      endedAt: new Date().toISOString(),
      reason: 'MANUALLY_ENDED',
      redirectUrl: `/webinar-ended/${id}?reason=Webinar was ended by host`
    });

    // Log action
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        webinarId: id,
        action: 'WEBINAR_STOPPED',
      },
    });

    res.json({ webinar, message: 'Webinar ended' });
  } catch (error) {
    console.error('Stop webinar error:', error);
    res.status(500).json({ error: 'Failed to stop webinar' });
  }
});

// Update webinar timestamp (for syncing)
router.post('/webinars/:id/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { currentTimestamp } = req.body;

    await prisma.webinarState.update({
      where: { webinarId: id },
      data: { currentTimestamp },
    });

    // Update Redis
    const stateStr = await redis.get(`webinar:${id}:state`);
    if (stateStr) {
      const state = JSON.parse(stateStr);
      state.currentTimestamp = currentTimestamp;
      await redis.set(`webinar:${id}:state`, JSON.stringify(state));
    }

    // Broadcast to clients
    io.to(`webinar:${id}`).emit('webinar:sync', { currentTimestamp });

    res.json({ success: true });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync' });
  }
});
// Add CSV upload endpoint
router.post('/automations/csv', upload.single('csv'), async (req: AuthRequest, res: Response) => {
  try {
    const { webinarId } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Parse CSV
    const csv = fs.readFileSync(file.path, 'utf8');
    const lines = csv.split('\n').slice(1); // Skip header
    
    const automations = [];
    
    // Clear existing automations for this webinar to prevent duplicates
    await prisma.automation.deleteMany({
      where: { webinarId }
    });
    
    for (const line of lines) {
      const [hour, minute, second, name, role, message, mode] = line.split(',');
      
      if (!hour || !minute || !second || !message) continue;
      
      const triggerAt = (parseInt(hour) * 3600) + (parseInt(minute) * 60) + parseInt(second);
      
      const automation = await prisma.automation.create({
        data: {
          webinarId,
          type: mode?.trim() === 'CTA' ? 'CTA_POPUP' : 'TIMED_MESSAGE',
          triggerAt,
          content: JSON.stringify({
            senderName: name?.trim() || 'System',  // Use name column
            message: message?.trim() || '',        // Use message column
            ...(mode?.trim() === 'CTA' && {
              title: 'Special Offer',
              description: message?.trim() || '',
              buttonText: 'Learn More',
              buttonUrl: '#'
            })
          }),
          enabled: true,
          executed: false, // Ensure not executed initially
        },
      });
      
      automations.push(automation);
    }
    
    // Clean up temp file
    fs.unlinkSync(file.path);
    
    res.json({ automations, count: automations.length });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
});

// Get chat messages
router.get('/webinars/:id/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: { webinarId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Pin message
router.post('/chat/:messageId/pin', async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: true },
    });

    // Broadcast pin event
    io.to(`webinar:${message.webinarId}`).emit('chat:pinned', {
      messageId: message.id,
      content: message.content,
      senderName: message.senderName,
    });

    res.json({ message });
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Unpin message
router.post('/chat/:messageId/unpin', async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: false },
    });

    io.to(`webinar:${message.webinarId}`).emit('chat:unpinned', {
      messageId: message.id,
    });

    res.json({ message });
  } catch (error) {
    console.error('Unpin message error:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

// Delete message
router.delete('/chat/:messageId', async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    io.to(`webinar:${message.webinarId}`).emit('chat:deleted', {
      messageId: message.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get automations
router.get('/webinars/:id/automations', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const automations = await prisma.automation.findMany({
      where: { webinarId: id },
      orderBy: { triggerAt: 'asc' },
    });

    res.json({ automations });
  } catch (error) {
    console.error('Get automations error:', error);
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

// Create automation
router.post(
  '/webinars/:id/automations',
  [
    body('type').isIn(['TIMED_MESSAGE', 'KEYWORD_REPLY', 'CTA_POPUP', 'OFFER_BANNER']),
    body('triggerAt').isInt({ min: 0 }),
    body('content').notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { type, triggerAt, content, enabled } = req.body;

      const automation = await prisma.automation.create({
        data: {
          webinarId: id,
          type,
          triggerAt,
          content: typeof content === 'string' ? content : JSON.stringify(content),
          enabled: enabled !== false,
        },
      });

      res.status(201).json({ automation });
    } catch (error) {
      console.error('Create automation error:', error);
      res.status(500).json({ error: 'Failed to create automation' });
    }
  }
);

// Update automation
router.put('/automations/:automationId', async (req: AuthRequest, res: Response) => {
  try {
    const { automationId } = req.params;
    const { type, triggerAt, content, enabled } = req.body;

    const automation = await prisma.automation.update({
      where: { id: automationId },
      data: {
        ...(type && { type }),
        ...(triggerAt !== undefined && { triggerAt }),
        ...(content && { content: typeof content === 'string' ? content : JSON.stringify(content) }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    res.json({ automation });
  } catch (error) {
    console.error('Update automation error:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// Delete automation
router.delete('/automations/:automationId', async (req: AuthRequest, res: Response) => {
  try {
    const { automationId } = req.params;

    await prisma.automation.delete({ where: { id: automationId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete automation error:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

// Get admin logs
router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 100, webinarId } = req.query;

    const logs = await prisma.adminLog.findMany({
      where: webinarId ? { webinarId: webinarId as string } : undefined,
      include: {
        user: {
          select: { name: true, email: true },
        },
        webinar: {
          select: { title: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Broadcast CTA popup manually
router.post('/webinars/:id/cta', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, buttonText, buttonUrl, duration } = req.body;

    io.to(`webinar:${id}`).emit('automation:cta', {
      type: 'CTA_POPUP',
      title,
      description,
      buttonText,
      buttonUrl,
      duration: duration || 30,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('CTA broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast CTA' });
  }
});

// Add fake viewers
router.post('/webinars/:id/add-viewers', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { count } = req.body;

    if (!count || count <= 0) {
      return res.status(400).json({ error: 'Count must be a positive number' });
    }

    // Get current fake viewers count from Redis
    let fakeViewers = 0;
    const fakeViewersStr = await redis.get(`webinar:${id}:fakeViewers`);
    if (fakeViewersStr) {
      fakeViewers = parseInt(fakeViewersStr);
    }

    // Add to the fake viewers count
    fakeViewers += count;
    await redis.set(`webinar:${id}:fakeViewers`, fakeViewers.toString());

    // Get current real viewers count
    const realViewersStr = await redis.get(`webinar:${id}:viewers`);
    const realViewers = realViewersStr ? parseInt(realViewersStr) : 0;

    // Calculate total viewers
    const totalViewers = realViewers + fakeViewers;

    // Broadcast updated viewer count to all clients
    io.to(`webinar:${id}`).emit('webinar:viewers', { count: totalViewers });

    res.json({ success: true, totalViewers });
  } catch (error) {
    console.error('Add fake viewers error:', error);
    res.status(500).json({ error: 'Failed to add fake viewers' });
  }
});

export default router;

