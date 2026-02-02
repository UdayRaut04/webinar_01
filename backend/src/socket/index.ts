import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma, redis } from '../index';

interface SocketUser {
  id?: string;
  name: string;
  email?: string;
  isGuest: boolean;
  registrationId?: string;
}

interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
  webinarId?: string;
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket, next) => {
    const authSocket = socket as AuthenticatedSocket;
    try {
      const token = socket.handshake.auth.token;
      const registrationId = socket.handshake.auth.registrationId;
      const guestName = socket.handshake.auth.guestName;

      if (token) {
        // Authenticated user
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, email: true, role: true },
        });

        if (user) {
          authSocket.user = {
            id: user.id,
            name: user.name || user.email || 'Admin',
            email: user.email,
            isGuest: false,
          };
        }
      } else if (registrationId) {
        // Registered attendee
        const registration = await prisma.registration.findUnique({
          where: { uniqueLink: registrationId },
        });

        if (registration) {
          authSocket.user = {
            name: registration.name,
            email: registration.email,
            isGuest: false,
            registrationId: registration.id,
          };
        }
      } else if (guestName) {
        // Guest viewer
        authSocket.user = {
          name: guestName,
          isGuest: true,
        };
      }

      if (!authSocket.user) {
        authSocket.user = {
          name: 'Anonymous',
          isGuest: true,
        };
      }

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (baseSocket) => {
    const socket = baseSocket as AuthenticatedSocket;
    console.log(`Client connected: ${socket.id} (${socket.user?.name})`);

    // Join webinar room
    socket.on('webinar:join', async (data: { webinarId: string }) => {
      const { webinarId } = data;
      socket.webinarId = webinarId;
      
      // Join the room
      socket.join(`webinar:${webinarId}`);

      // Get current state from Redis or DB
      let state = null;
      const stateStr = await redis.get(`webinar:${webinarId}:state`);
      
      if (stateStr) {
        state = JSON.parse(stateStr);
      } else {
        const dbState = await prisma.webinarState.findUnique({
          where: { webinarId },
        });
        if (dbState) {
          state = {
            isLive: dbState.isLive,
            startedAt: dbState.startedAt?.toISOString(),
            currentTimestamp: dbState.currentTimestamp,
          };
        }
      }

      // Update viewer count
      const roomSize = io.sockets.adapter.rooms.get(`webinar:${webinarId}`)?.size || 0;
      await redis.set(`webinar:${webinarId}:viewers`, roomSize.toString());

      // Broadcast updated viewer count
      io.to(`webinar:${webinarId}`).emit('webinar:viewers', { count: roomSize });

      // Get recent chat messages
      const messages = await prisma.chatMessage.findMany({
        where: { 
          webinarId, 
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // Get pinned message
      const pinnedMessage = await prisma.chatMessage.findFirst({
        where: { webinarId, isPinned: true, isDeleted: false },
      });

      // Send initial state to the client
      socket.emit('webinar:state', {
        ...state,
        viewerCount: roomSize,
        messages: messages.reverse(),
        pinnedMessage,
      });

      console.log(`${socket.user?.name} joined webinar ${webinarId}`);
    });

    // Handle chat messages
    socket.on('chat:message', async (data: { content: string }) => {
      if (!socket.webinarId || !socket.user) return;

      const { content } = data;
      if (!content || content.trim().length === 0) return;

      // Get current webinar timestamp
      const stateStr = await redis.get(`webinar:${socket.webinarId}:state`);
      let timestamp = 0;
      if (stateStr) {
        const state = JSON.parse(stateStr);
        if (state.startedAt) {
          timestamp = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
        }
      }

      // Save message to database
      const message = await prisma.chatMessage.create({
        data: {
          webinarId: socket.webinarId,
          userId: socket.user.id,
          senderName: socket.user.name,
          content: content.trim(),
          timestamp,
        },
      });

      // Broadcast to all clients in the room
socket.to(`webinar:${socket.webinarId}`).emit('chat:message', {
  id: message.id,
  senderName: message.senderName,
  content: message.content,
  timestamp: message.timestamp,
  createdAt: message.createdAt,
  isAutomated: false,
});
    });

    // Handle emoji reactions
    socket.on('reaction:send', (data: { emoji: string }) => {
      if (!socket.webinarId) return;

      io.to(`webinar:${socket.webinarId}`).emit('reaction:received', {
        emoji: data.emoji,
        userName: socket.user?.name,
      });
    });

    // Handle Q&A submission
    socket.on('qa:submit', async (data: { question: string }) => {
      if (!socket.webinarId || !socket.user) return;

      // Save as a chat message with Q&A prefix
      const message = await prisma.chatMessage.create({
        data: {
          webinarId: socket.webinarId,
          userId: socket.user.id,
          senderName: socket.user.name,
          content: `[Q&A] ${data.question}`,
          timestamp: 0,
        },
      });

      // Emit to admins only
      io.to(`webinar:${socket.webinarId}`).emit('qa:new', {
        id: message.id,
        question: data.question,
        askedBy: socket.user.name,
        createdAt: message.createdAt,
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      if (socket.webinarId) {
        // Update viewer count
        const roomSize = io.sockets.adapter.rooms.get(`webinar:${socket.webinarId}`)?.size || 0;
        await redis.set(`webinar:${socket.webinarId}:viewers`, roomSize.toString());

        io.to(`webinar:${socket.webinarId}`).emit('webinar:viewers', { count: roomSize });
      }
    });

    // Typing indicator
    socket.on('chat:typing', () => {
      if (!socket.webinarId) return;
      socket.to(`webinar:${socket.webinarId}`).emit('chat:userTyping', {
        userName: socket.user?.name,
      });
    });

    // Stop typing indicator
    socket.on('chat:stopTyping', () => {
      if (!socket.webinarId) return;
      socket.to(`webinar:${socket.webinarId}`).emit('chat:userStoppedTyping', {
        userName: socket.user?.name,
      });
    });
  });

  // Periodic sync broadcast for active webinars
  setInterval(async () => {
    const keys = await redis.keys('webinar:*:state');
    
    for (const key of keys) {
      const webinarId = key.split(':')[1];
      const stateStr = await redis.get(key);
      
      if (stateStr) {
        const state = JSON.parse(stateStr);
        
        if (state.isLive && state.startedAt) {
          const currentTimestamp = Math.floor(
            (Date.now() - new Date(state.startedAt).getTime()) / 1000
          );
          
          // Update state
          state.currentTimestamp = currentTimestamp;
          await redis.set(key, JSON.stringify(state));
          
          // Broadcast sync
          io.to(`webinar:${webinarId}`).emit('webinar:sync', {
            currentTimestamp,
            serverTime: Date.now(),
          });
        }
      }
    }
  }, 1000);
}

