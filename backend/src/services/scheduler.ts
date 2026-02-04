import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export class SchedulerService {
  private io: Server;
  private prisma: PrismaClient;
  private redis: Redis;
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server, prisma: PrismaClient, redis: Redis) {
    this.io = io;
    this.prisma = prisma;
    this.redis = redis;
  }

  start() {
    console.log('⏰ Scheduler service started');
    
    // Check for scheduled webinars every 30 seconds
    setInterval(() => this.checkScheduledWebinars(), 30000);
    
    // Initial check on startup
    this.checkScheduledWebinars();
  }

  private async checkScheduledWebinars() {
    try {
      const now = new Date();
      
      // Find webinars that are scheduled and should start now or in the past
      const scheduledWebinars = await this.prisma.webinar.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: now,
          },
        },
        include: { state: true },
      });

      for (const webinar of scheduledWebinars) {
        // Skip if already has a timer scheduled
        if (this.scheduledTimers.has(webinar.id)) {
          continue;
        }

        // Calculate delay until scheduled time
        const scheduledTime = new Date(webinar.scheduledAt).getTime();
        const currentTime = Date.now();
        const delay = Math.max(0, scheduledTime - currentTime);

        console.log(`Scheduling webinar ${webinar.title} to start in ${delay}ms`);

        // Set a timer to start the webinar
        const timer = setTimeout(async () => {
          await this.startWebinar(webinar.id);
          this.scheduledTimers.delete(webinar.id);
        }, delay);

        this.scheduledTimers.set(webinar.id, timer);
      }

      // Clean up timers for webinars that are no longer scheduled
      for (const [webinarId, timer] of this.scheduledTimers.entries()) {
        const webinar = await this.prisma.webinar.findUnique({
          where: { id: webinarId },
          select: { status: true, scheduledAt: true },
        });

        if (!webinar || webinar.status !== 'SCHEDULED') {
          clearTimeout(timer);
          this.scheduledTimers.delete(webinarId);
        }
      }
    } catch (error) {
      console.error('Check scheduled webinars error:', error);
    }
  }

  private async startWebinar(webinarId: string) {
    try {
      console.log(`Starting scheduled webinar: ${webinarId}`);
      
      // Update webinar status to LIVE
      const webinar = await this.prisma.webinar.update({
        where: { id: webinarId },
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
      await this.redis.set(`webinar:${webinarId}:state`, JSON.stringify({
        isLive: true,
        startedAt: new Date().toISOString(),
        currentTimestamp: 0,
      }));

      // Notify all connected clients
      this.io.to(`webinar:${webinarId}`).emit('webinar:started', {
        webinarId,
        startedAt: new Date().toISOString(),
      });

      // Log action
      await this.prisma.adminLog.create({
        data: {
          userId: webinar.hostId, // Use webinar host as the actor
          webinarId,
          action: 'WEBINAR_STARTED_AUTOMATICALLY',
          details: JSON.stringify({ 
            title: webinar.title,
            scheduledAt: webinar.scheduledAt,
            startedAt: new Date().toISOString()
          }),
        },
      });

      console.log(`✅ Webinar ${webinar.title} started automatically`);
    } catch (error) {
      console.error('Failed to start scheduled webinar:', error);
    }
  }

  stop() {
    // Clear all scheduled timers
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    console.log('⏰ Scheduler service stopped');
  }
}