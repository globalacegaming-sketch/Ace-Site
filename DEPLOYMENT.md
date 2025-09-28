# 🚀 Deployment Guide - Global Ace Gaming

This guide will help you deploy the Global Ace Gaming platform to Render (Backend) and Vercel (Frontend).

## 📋 Prerequisites

- GitHub repository with your code
- Render account (for backend)
- Vercel account (for frontend)
- MongoDB Atlas account (for database)
- FortunePanda API credentials

## 🗄️ Database Setup (MongoDB Atlas)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster
   - Note down your connection string

2. **Database Configuration**
   - Database Name: `globalacegaming`
   - Collections will be created automatically by the application

## 🔧 Backend Deployment (Render)

### Step 1: Prepare Backend Repository
1. Ensure your backend code is in the `backend/` directory
2. Make sure `package.json` has the correct scripts:
   ```json
   {
     "scripts": {
       "start": "node dist/index.js",
       "build": "tsc",
       "dev": "nodemon src/index.ts"
     }
   }
   ```

### Step 2: Deploy to Render
1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - **Name**: `global-ace-gaming-backend`
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: `backend`

3. **Environment Variables**
   Add these environment variables in Render dashboard:
   ```
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://your-frontend-url.vercel.app
   JWT_SECRET=your-super-secret-jwt-key-here
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/globalacegaming
   FORTUNE_PANDA_AGENT_NAME=your-agent-name
   FORTUNE_PANDA_AGENT_KEY=your-agent-key
   FORTUNE_PANDA_API_URL=https://api.fortunepanda.com
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your backend URL (e.g., `https://global-ace-gaming-backend.onrender.com`)

## 🎨 Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Repository
1. Ensure your frontend code is in the `frontend/` directory
2. Make sure `package.json` has the correct scripts:
   ```json
   {
     "scripts": {
       "build": "tsc -b && vite build",
       "dev": "vite"
     }
   }
   ```

### Step 2: Deploy to Vercel
1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment Variables**
   Add these environment variables in Vercel dashboard:
   ```
   VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
   VITE_WS_URL=wss://your-backend-url.onrender.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your frontend URL (e.g., `https://global-ace-gaming.vercel.app`)

## 🔄 Update Backend with Frontend URL

After deploying the frontend, update your backend environment variables:
1. Go to Render dashboard → Your backend service → Environment
2. Update `FRONTEND_URL` to your Vercel frontend URL
3. Redeploy the backend service

## 🧪 Testing Deployment

### Backend Health Check
```bash
curl https://your-backend-url.onrender.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Global Ace Gaming Backend",
  "version": "1.0.0"
}
```

### Frontend Test
1. Visit your Vercel frontend URL
2. Check if the application loads correctly
3. Test login/registration functionality

## 🔧 Environment Variables Reference

### Backend (Render)
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `10000` |
| `FRONTEND_URL` | Frontend URL | `https://your-app.vercel.app` |
| `JWT_SECRET` | JWT secret key | `your-secret-key` |
| `MONGODB_URI` | MongoDB connection | `mongodb+srv://...` |
| `FORTUNE_PANDA_AGENT_NAME` | FP agent name | `your-agent` |
| `FORTUNE_PANDA_AGENT_KEY` | FP agent key | `your-key` |
| `FORTUNE_PANDA_API_URL` | FP API URL | `https://api.fortunepanda.com` |

### Frontend (Vercel)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `https://your-backend.onrender.com/api` |
| `VITE_WS_URL` | WebSocket URL | `wss://your-backend.onrender.com` |

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation succeeds locally
   - Verify build commands are correct

2. **Environment Variables**
   - Double-check all environment variables are set
   - Ensure URLs don't have trailing slashes
   - Verify MongoDB connection string

3. **CORS Issues**
   - Ensure `FRONTEND_URL` is set correctly in backend
   - Check that frontend is calling the correct API URL

4. **Database Connection**
   - Verify MongoDB Atlas cluster is running
   - Check network access settings in MongoDB Atlas
   - Ensure connection string is correct

### Logs and Debugging

**Render (Backend)**
- Go to your service → Logs tab
- Check for error messages during build/startup

**Vercel (Frontend)**
- Go to your project → Functions tab
- Check build logs for errors

## 📈 Performance Optimization

### Backend Optimizations
- Enable gzip compression
- Use Redis for session storage (optional)
- Implement rate limiting
- Add request caching

### Frontend Optimizations
- Enable Vercel's edge functions
- Use CDN for static assets
- Implement lazy loading
- Optimize images

## 🔒 Security Considerations

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique secrets
   - Rotate secrets regularly

2. **CORS Configuration**
   - Only allow your frontend domain
   - Use HTTPS in production

3. **Database Security**
   - Use MongoDB Atlas security features
   - Enable IP whitelisting
   - Use strong passwords

## 📞 Support

If you encounter issues:
1. Check the logs in Render/Vercel dashboards
2. Verify all environment variables are set
3. Test locally first to isolate issues
4. Check MongoDB Atlas connection

## 🎯 Next Steps

After successful deployment:
1. Set up monitoring and alerts
2. Configure custom domains (optional)
3. Set up CI/CD pipelines
4. Implement backup strategies
5. Add performance monitoring

---

**Happy Deploying! 🚀**
