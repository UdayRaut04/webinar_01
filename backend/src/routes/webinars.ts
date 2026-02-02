import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all webinars (public - only shows scheduled/live)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const webinars = await prisma.webinar.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
      },
      include: {
        host: {
          select: { name: true, email: true },
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json({ webinars });
  } catch (error) {
    console.error('Get webinars error:', error);
    res.status(500).json({ error: 'Failed to fetch webinars' });
  }
});

// Get single webinar by slug (public)
router.get('/slug/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const webinar = await prisma.webinar.findUnique({
      where: { slug },
      include: {
        host: {
          select: { name: true, email: true },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    res.json({ webinar });
  } catch (error) {
    console.error('Get webinar error:', error);
    res.status(500).json({ error: 'Failed to fetch webinar' });
  }
});

// Get webinar by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const webinar = await prisma.webinar.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, name: true, email: true },
        },
        state: true,
        _count: {
          select: { registrations: true, chatMessages: true },
        },
      },
    });

    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    res.json({ webinar });
  } catch (error) {
    console.error('Get webinar error:', error);
    res.status(500).json({ error: 'Failed to fetch webinar' });
  }
});

// Create webinar (admin only)
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('title').notEmpty().trim(),
    body('slug').notEmpty().trim().toLowerCase(),
    body('description').optional().trim(),
    body('scheduledAt').isISO8601(),
    body('timezone').optional().default('UTC'),
    body('duration').optional().isInt({ min: 1 }).default(60),
    body('mode').optional().isIn(['LIVE', 'RECORDED', 'HYBRID']),
    body('videoUrl').optional().isURL(),
    body('accentColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        slug,
        description,
        scheduledAt,
        timezone,
        duration,
        mode,
        videoUrl,
        accentColor,
      } = req.body;

      // Check if slug is unique
      const existing = await prisma.webinar.findUnique({ where: { slug } });
      if (existing) {
        return res.status(400).json({ error: 'Slug already exists' });
      }

      const webinar = await prisma.webinar.create({
        data: {
          title,
          slug,
          description,
          scheduledAt: new Date(scheduledAt),
          timezone: timezone || 'UTC',
          duration: duration || 60,
          mode: mode || 'RECORDED',
          videoUrl,
          accentColor,
          hostId: req.user!.id,
          status: 'SCHEDULED',
          state: {
            create: {
              isLive: false,
              currentTimestamp: 0,
            },
          },
        },
        include: {
          host: {
            select: { name: true, email: true },
          },
          state: true,
        },
      });

      // Log action
      await prisma.adminLog.create({
        data: {
          userId: req.user!.id,
          webinarId: webinar.id,
          action: 'WEBINAR_CREATED',
          details: JSON.stringify({ title, slug }),
        },
      });

      res.status(201).json({ webinar });
    } catch (error) {
      console.error('Create webinar error:', error);
      res.status(500).json({ error: 'Failed to create webinar' });
    }
  }
);

// Update webinar (admin only)
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        scheduledAt,
        timezone,
        duration,
        mode,
        videoUrl,
        thumbnailUrl,
        accentColor,
        status,
      } = req.body;

      const webinar = await prisma.webinar.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
          ...(timezone && { timezone }),
          ...(duration && { duration }),
          ...(mode && { mode }),
          ...(videoUrl !== undefined && { videoUrl }),
          ...(thumbnailUrl !== undefined && { thumbnailUrl }),
          ...(accentColor && { accentColor }),
          ...(status && { status }),
        },
        include: {
          host: {
            select: { name: true, email: true },
          },
          state: true,
        },
      });

      // Log action
      await prisma.adminLog.create({
        data: {
          userId: req.user!.id,
          webinarId: webinar.id,
          action: 'WEBINAR_UPDATED',
          details: JSON.stringify(req.body),
        },
      });

      res.json({ webinar });
    } catch (error) {
      console.error('Update webinar error:', error);
      res.status(500).json({ error: 'Failed to update webinar' });
    }
  }
);

// Delete webinar (admin only)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await prisma.webinar.delete({ where: { id } });

      // Log action
      await prisma.adminLog.create({
        data: {
          userId: req.user!.id,
          action: 'WEBINAR_DELETED',
          details: JSON.stringify({ webinarId: id }),
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete webinar error:', error);
      res.status(500).json({ error: 'Failed to delete webinar' });
    }
  }
);

// Register for webinar (public)
router.post(
  '/:id/register',
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('consent').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, email, phone, consent } = req.body;

      // Check webinar exists
      const webinar = await prisma.webinar.findUnique({ where: { id } });
      if (!webinar) {
        return res.status(404).json({ error: 'Webinar not found' });
      }

      // Check if already registered
      const existing = await prisma.registration.findFirst({
        where: { webinarId: id, email },
      });

      if (existing) {
        return res.json({ 
          registration: existing,
          message: 'Already registered',
        });
      }

      // Create registration
      const registration = await prisma.registration.create({
        data: {
          webinarId: id,
          name,
          email,
          phone,
          consent: consent !== false,
        },
        include: {
          webinar: {
            select: { title: true, scheduledAt: true, slug: true },
          },
        },
      });

      res.status(201).json({ registration });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Join webinar via unique link
router.get('/join/:uniqueLink', async (req: AuthRequest, res: Response) => {
  try {
    const { uniqueLink } = req.params;

    const registration = await prisma.registration.findUnique({
      where: { uniqueLink },
      include: {
        webinar: {
          include: {
            host: {
              select: { name: true },
            },
            state: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    // Mark as attended if webinar is live
    if (registration.webinar.status === 'LIVE' && !registration.attended) {
      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          attended: true,
          attendedAt: new Date(),
        },
      });
    }

    res.json({ registration });
  } catch (error) {
    console.error('Join error:', error);
    res.status(500).json({ error: 'Failed to join' });
  }
});

export default router;
