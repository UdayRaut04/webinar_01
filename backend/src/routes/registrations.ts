import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get registration by unique link
router.get('/:uniqueLink', async (req: AuthRequest, res: Response) => {
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
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({ registration });
  } catch (error) {
    console.error('Get registration error:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
});

// Check registration status
router.get('/:uniqueLink/status', async (req: AuthRequest, res: Response) => {
  try {
    const { uniqueLink } = req.params;

    const registration = await prisma.registration.findUnique({
      where: { uniqueLink },
      include: {
        webinar: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const now = new Date();
    const scheduledAt = new Date(registration.webinar.scheduledAt);
    const timeUntilStart = scheduledAt.getTime() - now.getTime();

    res.json({
      status: registration.webinar.status,
      scheduledAt: registration.webinar.scheduledAt,
      timeUntilStart: Math.max(0, timeUntilStart),
      canJoin: registration.webinar.status === 'LIVE' || 
               (registration.webinar.status === 'SCHEDULED' && timeUntilStart <= 15 * 60 * 1000),
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Mark attendance
router.post('/:uniqueLink/attend', async (req: AuthRequest, res: Response) => {
  try {
    const { uniqueLink } = req.params;

    const registration = await prisma.registration.update({
      where: { uniqueLink },
      data: {
        attended: true,
        attendedAt: new Date(),
      },
    });

    res.json({ registration });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

export default router;
