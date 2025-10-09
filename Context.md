🌍 Global Ace Gaming – Product Specification & Technical Context

This document serves as a comprehensive product specification and technical blueprint for the Global Ace Gaming platform with FortunePanda API integration.

## 🎯 Product Overview

**Global Ace Gaming** is a premium online gaming platform that provides users with access to a diverse collection of casino games, slots, live games, fishing games, and sports betting through seamless FortunePanda API integration. The platform features a modern, responsive design with real-time balance tracking, secure authentication, and an intuitive user experience.

### 🎮 Core Features
- **Game Hub**: Access to 100+ games across multiple categories
- **Real-time Balance**: Live balance updates every 30 seconds
- **Secure Authentication**: JWT-based user authentication
- **Responsive Design**: Mobile-first, modern UI/UX
- **Category Filtering**: Organized game browsing by type
- **Auto Account Creation**: Seamless FortunePanda account integration
- **Game Launch**: Direct game access with popup management

## 🔹 Tech Stack

### Frontend (User Website)
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: TailwindCSS with custom gradients and animations
- **State Management**: Zustand (replaced Redux Toolkit)
- **API Calls**: Axios (to backend only, never directly to FortunePanda)
- **Authentication**: JWT stored in localStorage
- **Icons**: Lucide React
- **Custom Hooks**: useBalancePolling for real-time balance updates

### Backend (Core Logic)
- **Framework**: Node.js + Express.js + TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Security**: Bcrypt (user passwords), JWT, Helmet
- **External APIs**: FortunePanda Terminal API integration
- **Crypto**: MD5 hashing for API signatures
- **Environment**: dotenv for configuration management

## 🔹 User Experience Flow

### 1. User Registration & Authentication
- **Signup**: User registers with email, password, first name, last name
- **Auto Account Creation**: Backend automatically creates FortunePanda account with format `{firstName}_Aces9F`
- **Login**: JWT-based authentication with secure token storage
- **Session Management**: Persistent login state with automatic token refresh

### 2. Game Discovery & Selection
- **Game Hub**: Modern, responsive interface displaying all available games
- **Category Filtering**: Filter games by All, Slots, Fishing, Live, Sports
- **Visual Design**: Premium game cards with hover effects and animations
- **Game Information**: Display game name, type, and unique ID

### 3. Real-time Balance Management
- **Live Updates**: Balance refreshes every 30 seconds automatically
- **Manual Refresh**: Users can manually refresh balance with dedicated button
- **Visual Feedback**: Loading states and smooth transitions
- **Username Display**: Shows FortunePanda username format in balance widget

### 4. Game Launch Experience
- **One-Click Play**: Direct game access with authentication check
- **Popup Management**: Games open in new windows with proper dimensions
- **Loading States**: Visual feedback during game initialization
- **Error Handling**: User-friendly error messages for failed launches

### 5. Responsive Design
- **Mobile-First**: Optimized for all device sizes
- **Adaptive Layout**: Grid adjusts from 2 columns (mobile) to 6 columns (desktop)
- **Touch-Friendly**: Large buttons and intuitive navigation
- **Performance**: Smooth animations and fast loading times

## 🔹 Technical Implementation Details

### Frontend Architecture
```
src/
├── components/
│   └── layout/          # Header, Footer, Layout components
├── pages/               # Main application pages
│   ├── Games.tsx        # Game hub with filtering and balance
│   ├── Login.tsx        # User authentication
│   ├── Register.tsx     # User registration
│   └── Dashboard.tsx    # User dashboard
├── stores/
│   └── authStore.ts     # Zustand authentication state
├── services/
│   └── fortunePandaApi.ts # API service layer
├── hooks/
│   └── useBalancePolling.ts # Custom balance polling hook
├── utils/
│   └── api.ts           # API configuration utilities
└── types/
    └── index.ts         # TypeScript type definitions
```

### Backend Architecture
```
src/
├── routes/
│   ├── auth.ts          # Authentication endpoints
│   ├── fortunePanda.ts  # Admin FortunePanda operations
│   ├── fortunePandaUser.ts # User FortunePanda operations
│   └── proxy.ts         # Game list proxy
├── services/
│   ├── fortunePandaService.ts # FortunePanda API integration
│   └── agentLoginService.ts   # Agent authentication
├── models/
│   └── User.ts          # MongoDB user schema
├── middleware/
│   ├── auth.ts          # JWT authentication middleware
│   ├── errorHandler.ts  # Global error handling
│   └── notFound.ts      # 404 handling
└── utils/
    └── jwt.ts           # JWT utilities
```

### Database Schema (MongoDB)
```typescript
// User Model
interface IUser {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // bcrypt hashed
  fortunePandaAccount?: string; // Auto-generated: {firstName}_Aces9F
  fortunePandaPassword?: string; // MD5 hashed
  createdAt: Date;
  updatedAt: Date;
}
```

### State Management (Zustand)
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  fortunePandaBalance: string | null;
  balanceLastUpdated: number | null;
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (session: UserSession) => void;
  logout: () => void;
  setFortunePandaBalance: (balance: string) => void;
  setBalanceLastUpdated: (timestamp: number) => void;
}
```

## 🔹 FortunePanda API Integration

### API Endpoints & Usage
| Action | API Endpoint | Usage | Implementation Status |
|--------|-------------|-------|---------------------|
| Agent Login | `agentLogin` | Cached agentKey for other calls | ✅ Implemented |
| Register User | `registerUser` | On user signup | ✅ Implemented |
| Query User Info | `queryInfo` | User balance sync | ✅ Implemented |
| Get Game List | `getGameList` | Populate games page | ✅ Implemented |
| Enter Game | `entergame` | Game session for user | ✅ Implemented |

### API Signature Generation
```typescript
// All FortunePanda API calls require this signature:
const sign = md5(agentName.toLowerCase() + time.toString() + agentKey.toLowerCase());

// Where:
// - agentName: From environment variables
// - time: Current timestamp in milliseconds
// - agentKey: Retrieved from agentLogin (cached)
```

## 🔹 Backend API Endpoints

### User Routes (Implemented)
- `POST /auth/signup` → User registration + FortunePanda account creation
- `POST /auth/login` → User authentication, return JWT
- `GET /fortune-panda-user/balance` → Get user's FortunePanda balance
- `POST /fortune-panda-user/enter-game` → Launch game session
- `GET /games` → Get game list (public endpoint)

### Admin Routes (Available)
- `POST /admin/user/create` → Create user
- `GET /admin/users` → List users
- `GET /admin/deposits` → View all deposit logs
- `POST /admin/deposit/approve` → Approve agent deposit
- `POST /admin/withdraw/approve` → Approve withdrawal
- `GET /admin/trades` → getTradeRecord
- `GET /admin/jackpots` → getJpRecord
- `GET /admin/game-records` → getGameRecord

## 🔹 Key Features Implemented

### ✅ Game Hub Experience
- **Modern UI**: Premium design with gradients and animations
- **Category Filtering**: All, Slots, Fishing, Live, Sports
- **Responsive Grid**: 2-6 columns based on screen size
- **Game Cards**: Hover effects, type badges, play buttons
- **Loading States**: Visual feedback during game launch

### ✅ Real-time Balance System
- **Auto Polling**: Updates every 30 seconds
- **Manual Refresh**: Dedicated refresh button
- **Visual Widget**: Fixed top-right corner display
- **Username Display**: Shows FortunePanda format
- **Error Handling**: Graceful fallbacks

### ✅ Authentication Flow
- **JWT Tokens**: Secure authentication
- **Auto Account Creation**: FortunePanda accounts created on signup
- **Session Management**: Persistent login state
- **Protected Routes**: Authentication middleware

### ✅ Game Launch System
- **One-Click Play**: Direct game access
- **Popup Management**: Proper window handling
- **Error Handling**: User-friendly messages
- **Loading States**: Visual feedback

## 🔹 Security & Performance

### Security Measures
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for user passwords
- **MD5 Signatures**: Required for FortunePanda API calls
- **Environment Variables**: Secure configuration management
- **CORS Protection**: Proper cross-origin handling

### Performance Optimizations
- **Custom Hooks**: Efficient balance polling
- **State Management**: Zustand for minimal re-renders
- **Lazy Loading**: Optimized component loading
- **Error Boundaries**: Graceful error handling
- **Responsive Design**: Mobile-first approach

## 🔹 Deployment Configuration

### Environment Variables
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/ace-gaming
JWT_SECRET=your-jwt-secret
FORTUNE_API_URL=https://api.fortunepanda.com
FORTUNE_AGENT_NAME=your-agent-name
FORTUNE_AGENT_PASSWORD=your-agent-password

# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:3001/api
VITE_GAMES_API_URL=http://localhost:3001/api/games
```

### Production Ready Features
- **TypeScript**: Full type safety
- **Error Handling**: Comprehensive error management
- **Logging**: Debug and production logging
- **Validation**: Input validation and sanitization
- **Testing**: Ready for automated testing integration