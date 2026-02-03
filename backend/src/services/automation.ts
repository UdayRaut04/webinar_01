import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import cron from 'node-cron';

export class AutomationService {
  private io: Server;
  private prisma: PrismaClient;
  private redis: Redis;
  private activeWebinars: Map<string, NodeJS.Timeout[]> = new Map();

  constructor(io: Server, prisma: PrismaClient, redis: Redis) {
    this.io = io;
    this.prisma = prisma;
    this.redis = redis;
  }

  start() {
    console.log('🤖 Automation service started');

    // Check for active webinars every 5 seconds
    setInterval(() => this.checkActiveWebinars(), 5000);

    // Cleanup old automation flags every hour
    cron.schedule('0 * * * *', () => this.cleanupAutomations());
  }

  private async checkActiveWebinars() {
    try {
      const liveWebinars = await this.prisma.webinar.findMany({
        where: { status: 'LIVE' },
        include: { state: true },
      });

      for (const webinar of liveWebinars) {
        if (!this.activeWebinars.has(webinar.id)) {
          await this.startWebinarAutomations(webinar.id);
        }
      }

      // Stop automations for ended webinars
      for (const [webinarId] of this.activeWebinars) {
        const isStillLive = liveWebinars.some(w => w.id === webinarId);
        if (!isStillLive) {
          this.stopWebinarAutomations(webinarId);
        }
      }
    } catch (error) {
      console.error('Check active webinars error:', error);
    }
  }

  private async startWebinarAutomations(webinarId: string) {
    console.log(`Starting automations for webinar ${webinarId}`);

    const automations = await this.prisma.automation.findMany({
      where: {
        webinarId,
        enabled: true,
        executed: false,
      },
      orderBy: { triggerAt: 'asc' },
    });

    const timeouts: NodeJS.Timeout[] = [];

    // Get webinar start time
    const stateStr = await this.redis.get(`webinar:${webinarId}:state`);
    if (!stateStr) return;

    const state = JSON.parse(stateStr);
    if (!state.startedAt) return;

    const startedAt = new Date(state.startedAt).getTime();
    const currentTimestamp = Math.floor((Date.now() - startedAt) / 1000);

    for (const automation of automations) {
      // Skip if automation time has passed
      if (automation.triggerAt < currentTimestamp) continue;

      const delay = (automation.triggerAt - currentTimestamp) * 1000;

      const timeout = setTimeout(async () => {
        await this.executeAutomation(automation.id);
      }, delay);

      timeouts.push(timeout);
    }

    this.activeWebinars.set(webinarId, timeouts);
  }

  private stopWebinarAutomations(webinarId: string) {
    const timeouts = this.activeWebinars.get(webinarId);
    if (timeouts) {
      timeouts.forEach(t => clearTimeout(t));
      this.activeWebinars.delete(webinarId);
      console.log(`Stopped automations for webinar ${webinarId}`);
    }
  }

   private async executeAutomation(automationId: string) {
    try {
      // Try to atomically mark as executed to prevent race conditions
      const automation = await this.prisma.automation.update({
        where: { 
          id: automationId,
          executed: false  // Only update if not already executed
        },
        data: {
          executed: true,
          executedAt: new Date(),
        },
        include: { webinar: true },
      });

      let content: any;
      try {
        content = JSON.parse(automation.content);
      } catch {
        content = { message: automation.content };
      }

      switch (automation.type) {
        case 'TIMED_MESSAGE':
          await this.sendTimedMessage(automation.webinarId, content);
          break;

        case 'CTA_POPUP':
          await this.sendCTAPopup(automation.webinarId, content);
          break;

        case 'OFFER_BANNER':
          await this.sendOfferBanner(automation.webinarId, content);
          break;

        case 'KEYWORD_REPLY':
          // Keyword replies are handled separately in chat handler
          break;
      }

      console.log(`Executed automation ${automationId} (${automation.type})`);
    } catch (error) {
      // If we get a PrismaClientKnownRequestError with code 'P2025', 
      // it means no record was found (likely already executed by another process)
      if ((error as any).code === 'P2025' || (error as Error).message.includes('No')) {
        // Record was already executed, this is expected in concurrent scenarios
        return;
      }
      
      console.error('Execute automation error:', error);
    }
  }

  private async sendTimedMessage(webinarId: string, content: any) {
    const message = await this.prisma.chatMessage.create({
      data: {
        webinarId,
        senderName: content.senderName || 'Webinar Bot',
        content: content.message || content,
        isAutomated: true,
        timestamp: await this.getCurrentTimestamp(webinarId),
      },
    });

    this.io.to(`webinar:${webinarId}`).emit('chat:message', {
      id: message.id,
      senderName: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      createdAt: message.createdAt,
      isAutomated: true,
    });
  }

  private async sendCTAPopup(webinarId: string, content: any) {
    this.io.to(`webinar:${webinarId}`).emit('automation:cta', {
      type: 'CTA_POPUP',
      title: content.title || 'Special Offer',
      description: content.description || '',
      buttonText: content.buttonText || 'Learn More',
      buttonUrl: content.buttonUrl || '#',
      duration: content.duration || 30,
    });
  }

  private async sendOfferBanner(webinarId: string, content: any) {
    this.io.to(`webinar:${webinarId}`).emit('automation:banner', {
      type: 'OFFER_BANNER',
      text: content.text || 'Limited Time Offer!',
      backgroundColor: content.backgroundColor || '#6366f1',
      textColor: content.textColor || '#ffffff',
      duration: content.duration || 60,
    });
  }

  private async getCurrentTimestamp(webinarId: string): Promise<number> {
    const stateStr = await this.redis.get(`webinar:${webinarId}:state`);
    if (!stateStr) return 0;

    const state = JSON.parse(stateStr);
    if (!state.startedAt) return 0;

    return Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  }

  private async cleanupAutomations() {
    // Reset executed flag for ended webinars
    const endedWebinars = await this.prisma.webinar.findMany({
      where: { status: 'ENDED' },
      select: { id: true },
    });

    for (const webinar of endedWebinars) {
      await this.prisma.automation.updateMany({
        where: { webinarId: webinar.id },
        data: { executed: false },
      });
    }

    console.log('Cleaned up automations');
  }

  // Public method to handle keyword-based auto-replies
  async checkKeywordTrigger(webinarId: string, messageContent: string): Promise<void> {
    const keywordAutomations = await this.prisma.automation.findMany({
      where: {
        webinarId,
        type: 'KEYWORD_REPLY',
        enabled: true,
      },
    });

    for (const automation of keywordAutomations) {
      let content: any;
      try {
        content = JSON.parse(automation.content);
      } catch {
        continue;
      }

      const keyword = content.keyword?.toLowerCase();
      if (keyword && messageContent.toLowerCase().includes(keyword)) {
        // Send auto-reply
        setTimeout(() => {
          this.sendTimedMessage(webinarId, {
            senderName: content.replySenderName || 'Webinar Bot',
            message: content.replyMessage,
          });
        }, 1000); // Small delay to feel natural
      }
    }
  }
}
