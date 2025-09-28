# 🌍 Global Ace Gaming Platform

A comprehensive online gaming platform that integrates with FortunePanda API, featuring user management, game integration, crypto payments, and agent-based financial operations.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser

### Option 1: Quick Start (Recommended)
```bash
# Make the script executable and run
chmod +x start-dev.sh
./start-dev.sh
```

### Option 2: Manual Setup

#### Frontend Setup
```bash
cd frontend
npm install
# Copy environment file
cp env.example .env.local
# Edit .env.local with your backend URL
npm run dev
```

#### Backend Setup
```bash
cd backend
npm install
# Copy environment file
cp env.example .env
# Edit .env with your configuration
npm run dev
```

## 🏗️ Project Structure

```
GLOBAL ACE GAMING/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── backend/                  # Node.js + Express backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Express middleware
│   │   └── index.ts        # Main server file
│   └── package.json
└── Context.md               # Technical architecture & implementation plan
```

## 🎯 Features

### ✅ Implemented
- **Frontend Foundation**: Vite + React + TypeScript setup
- **UI Components**: Tailwind CSS with custom design system
- **Routing**: React Router with protected routes
- **State Management**: Zustand stores for auth, games, and content
- **Authentication**: Login/Register with FortunePanda integration
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Backend Foundation**: Express server with TypeScript
- **API Structure**: RESTful API endpoints setup
- **WebSocket Support**: Real-time game communication

### 🚧 In Development
- **Game Integration**: FortunePanda API integration
- **Financial Operations**: Deposit/Withdrawal system
- **Content Management**: Banners, features, promotions
- **Admin Panel**: Transaction approval and user management

### 📋 Planned
- **Crypto Payments**: NowPayments/Coinbase Commerce integration
- **Database**: PostgreSQL with Prisma ORM
- **File Upload**: Cloudinary integration
- **Email System**: Nodemailer with SendGrid
- **Background Jobs**: Bull + Redis queue system

## 🔧 Technology Stack

### Frontend
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + Headless UI
- **State Management**: Zustand
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Notifications**: React Hot Toast

### Backend
- **Runtime**: Node.js + Express.js
- **Language**: TypeScript
- **Security**: Helmet, CORS, JWT
- **WebSockets**: Socket.io
- **File Upload**: Multer
- **Validation**: Joi/Zod

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/balance` - Get user balance

### Games
- `GET /api/games` - Get game list
- `POST /api/games/launch` - Launch game
- `GET /api/games/:id` - Get game details

### Transactions
- `POST /api/transactions/deposit` - Create deposit
- `POST /api/transactions/withdraw` - Create withdrawal
- `GET /api/transactions/history` - Get transaction history

### Content
- `GET /api/content/banners` - Get banners
- `GET /api/content/features` - Get features
- `GET /api/content/promotions` - Get promotions

## 🎮 FortunePanda Integration

The platform integrates with FortunePanda API for:
- User registration and authentication
- Game launching and management
- Balance synchronization
- Transaction processing

### API Actions
- `agentLogin` - Agent authentication
- `registerUser` - User account creation
- `queryInfo` - User information and balance
- `getgamelist` - Available games
- `entergame` - Launch specific game
- `recharge` - User deposits
- `redeem` - User withdrawals

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **CORS Protection**: Cross-origin resource sharing security
- **Helmet Security**: HTTP security headers
- **Input Validation**: Request data validation
- **Rate Limiting**: API abuse prevention
- **Secure Headers**: XSS and CSRF protection

## 📱 User Experience

### User Flow
1. **Registration**: Automatic account creation on first login
2. **Authentication**: Secure login with JWT tokens
3. **Game Selection**: Browse and select from 1000+ games
4. **Game Launch**: Seamless integration with FortunePanda
5. **Financial Operations**: Easy deposit/withdrawal system
6. **Support**: 24/7 customer assistance

### Design Principles
- **Mobile-First**: Responsive design for all devices
- **Accessibility**: WCAG compliant interface
- **Performance**: Optimized loading and rendering
- **User-Friendly**: Intuitive navigation and controls

## 🚀 Development

### Scripts

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

#### Backend
```bash
npm run dev          # Start development server with nodemon
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
```

### Environment Variables

Create `.env` files in both frontend and backend directories:

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key
```

## 📊 Performance & Monitoring

- **Frontend Optimization**: Code splitting, lazy loading, image optimization
- **Backend Optimization**: Database indexing, Redis caching, connection pooling
- **Monitoring**: Sentry error tracking, performance monitoring
- **Analytics**: User behavior tracking, transaction success rates

## 🧪 Testing

### Frontend Testing
- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Component isolation testing
- **E2E Tests**: Playwright for end-to-end testing

### Backend Testing
- **Unit Tests**: Jest for API testing
- **Integration Tests**: Database and API endpoint testing
- **Load Testing**: Performance and scalability testing

## 📈 Deployment

### Quick Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Frontend (Vercel)
- **Platform**: Vercel (recommended)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Root Directory**: `frontend`

### Backend (Render)
- **Platform**: Render (recommended)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: `backend`

### Environment Setup
1. Copy `backend/env.example` to `backend/.env` and configure
2. Copy `frontend/env.example` to `frontend/.env.local` and configure
3. Set up MongoDB Atlas database
4. Configure FortunePanda API credentials

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- **Email**: support@globalacegaming.com
- **Documentation**: See `Context.md` for technical details
- **Issues**: Create GitHub issues for bugs and feature requests

## 🔮 Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and structure
- [x] Basic UI components
- [x] Authentication system
- [x] Routing and navigation

### Phase 2: Core Features 🚧
- [ ] Game integration
- [ ] User dashboard
- [ ] Basic wallet functionality
- [ ] Game launching system

### Phase 3: Financial System 📋
- [ ] Deposit system (Crypto + Agent)
- [ ] Withdrawal system
- [ ] Transaction management
- [ ] Balance synchronization

### Phase 4: Admin Panel 📋
- [ ] Admin authentication
- [ ] Transaction approval system
- [ ] Content management
- [ ] User management

### Phase 5: Polish & Testing 📋
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Testing and bug fixes
- [ ] Deployment preparation

---

**Global Ace Gaming** - Experience the future of online gaming! 🎮✨
