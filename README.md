# Webinar Platform

A production-ready webinar SaaS platform with real-time streaming, chat, and automation.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (recommended)
- Or: PostgreSQL 15+ and Redis 7+

### Option 1: Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy, then run migrations
cd backend
npm install
npx prisma migrate dev
npm run seed

# Access the app
# Frontend: http://localhost:3000
# Backend: http://localhost:4000
```

### Option 2: Local Development

```bash
# Start PostgreSQL and Redis locally first

# Backend setup
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

## Default Credentials

- Email: admin@webinar.com
- Password: admin123

## Features

- Live & pre-recorded webinars
- Real-time chat with WebSocket
- Automated messages & CTA popups
- Viewer synchronization
- Admin dashboard
- Registration system

## Tech Stack

- Frontend: Next.js 14, React, Tailwind CSS
- Backend: Node.js, Express, Socket.io
- Database: PostgreSQL, Prisma ORM
- Cache: Redis
