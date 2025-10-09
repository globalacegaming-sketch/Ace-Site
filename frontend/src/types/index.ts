// User related types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  country?: string;
  currency?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  role: 'user' | 'admin' | 'moderator';
  lastLogin?: string;
  fortunePandaUsername?: string;
  fortunePandaPassword?: string;
  fortunePandaBalance?: number;
  fortunePandaLastSync?: string;
  referralCode?: string;
  referredBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  user: User;
  token: string;
  expires_at: string;
}

// Game related types
export interface Game {
  id: string;
  name: string;
  platform: string;
  kind_id: string;
  logo_url: string;
  game_type: string;
  status: 'active' | 'inactive';
  description?: string;
}

export interface Platform {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  status: 'active' | 'inactive';
  created_at: string;
}

// Transaction types
export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdraw';
  method: 'crypto' | 'agent';
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'processing';
  ref_id: string;
  fp_response?: any;
  created_at: string;
}

export interface CryptoDeposit {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  tx_hash?: string;
  address: string;
  status: 'pending' | 'confirmed' | 'completed' | 'error';
  fp_status: 'success' | 'failed' | 'retrying';
  created_at: string;
}

export interface AgentDeposit {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed';
  fp_status: 'success' | 'failed';
  created_at: string;
}

// Content types
export interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url?: string;
  status: 'active' | 'inactive';
  order_index: number;
  created_at: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'bonus' | 'discount' | 'free_spins';
  value: string;
  status: 'active' | 'inactive' | 'expired';
  expiry_date: string;
  created_at: string;
}

// FortunePanda API types
export interface FortunePandaResponse {
  code: string | number;
  msg?: string;
  data?: any;
  balance?: string;
  agentkey?: string;
  webLoginUrl?: string;
  gameId?: string;
  userBalance?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface DepositForm {
  amount: number;
  method: 'crypto' | 'agent';
  currency?: string;
}

export interface WithdrawForm {
  amount: number;
  method: 'crypto' | 'agent';
  address?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Game launch types
export interface GameLaunchRequest {
  account: string;
  kindId: string;
}

export interface GameLaunchResponse {
  webLoginUrl: string;
  gameId: string;
  userBalance: string;
}

// Status types
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'processing';
export type FpStatus = 'success' | 'failed' | 'retrying' | 'not_started';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type ContentStatus = 'active' | 'inactive' | 'expired';
