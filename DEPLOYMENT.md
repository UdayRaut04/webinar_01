# 🚀 Free Deployment Guide for Webinar Platform

This guide will help you deploy your Webinar Platform with **$0 cost** using:
- **Vercel** - Frontend (Next.js)
- **Render** - Backend API
- **Supabase** - PostgreSQL Database
- **Upstash** - Redis Cache

---

## Step 1: Set Up Supabase (PostgreSQL Database)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up with GitHub (free)
3. Click **"New Project"**
4. Fill in:
   - **Name**: `webinar-db`
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users
5. Wait for project to be created (~2 minutes)
6. Go to **Settings** → **Database**
7. Copy the **Connection String (URI)** - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
8. **SAVE THIS URL** - you'll need it for the backend

---

## Step 2: Set Up Upstash (Redis Cache)

1. Go to [https://upstash.com](https://upstash.com)
2. Sign up with GitHub (free)
3. Click **"Create Database"**
4. Fill in:
   - **Name**: `webinar-redis`
   - **Type**: Regional
   - **Region**: Choose closest to your backend
5. After creation, go to **REST API** section
6. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**
7. For the `REDIS_URL`, use the connection string from the **Details** tab:
   ```
   redis://default:xxxxx@global-xxxxx.upstash.io:6379
   ```

---

## Step 3: Deploy Backend on Render

1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub (free)
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository: `Razer255/Webinar_v1`
5. Configure the service:
   - **Name**: `webinar-backend`
   - **Region**: Choose closest to your database
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free`

6. Add **Environment Variables** (click "Advanced"):
   ```
   DATABASE_URL = [Your Supabase PostgreSQL URL from Step 1]
   REDIS_URL = [Your Upstash Redis URL from Step 2]
   JWT_SECRET = your-super-secret-jwt-key-make-this-long-and-random
   NODE_ENV = production
   PORT = 4000
   ```

7. Click **"Create Web Service"**
8. Wait for deployment (~5 minutes)
9. **Copy the URL** Render gives you (e.g., `https://webinar-backend-xxxx.onrender.com`)

### After First Deploy - Run Database Migration:
1. Go to your Render service dashboard
2. Click **"Shell"** tab
3. Run: `npx prisma migrate deploy`
4. Run: `npm run seed` (to create admin user)

---

## Step 4: Deploy Frontend on Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Sign up with GitHub (free)
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository: `Razer255/Webinar_v1`
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`

6. Add **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL = https://webinar-backend-xxxx.onrender.com
   NEXT_PUBLIC_WS_URL = wss://webinar-backend-xxxx.onrender.com
   ```
   (Replace with your actual Render backend URL from Step 3)

7. Click **"Deploy"**
8. Wait for deployment (~3 minutes)
9. Your app is now live! 🎉

---

## 🎉 Your App URLs

After deployment, you'll have:
- **Frontend**: `https://webinar-v1.vercel.app` (or custom domain)
- **Backend**: `https://webinar-backend-xxxx.onrender.com`

---

## Default Login Credentials

- **Email**: admin@webinar.com
- **Password**: admin123

---

## 📝 Important Notes

### Free Tier Limitations:
1. **Render Free Tier**: Server sleeps after 15 min of inactivity. First request takes ~30 seconds to wake up.
2. **Supabase Free Tier**: Projects pause after 1 week of inactivity. Visit dashboard to resume.
3. **Vercel Free Tier**: Unlimited for hobby use.

### Custom Domain (Optional):
- **Vercel**: Go to Project Settings → Domains → Add your domain
- **Render**: Go to Service Settings → Custom Domains

---

## 🔧 Troubleshooting

### Backend not connecting to database:
- Check DATABASE_URL is correct in Render environment variables
- Make sure you ran `npx prisma migrate deploy` in Render shell

### WebSocket not working:
- Ensure NEXT_PUBLIC_WS_URL uses `wss://` (not `ws://`)
- Check CORS settings in backend

### Images not loading:
- Update next.config.js remotePatterns to include your Render domain
