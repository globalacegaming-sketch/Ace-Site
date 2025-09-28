import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface FortunePandaConfig {
  agentName: string;
  agentPasswd: string;
  baseUrl: string;
}

interface FortunePandaSession {
  agentKey: string;
  expiresAt: number;
  isActive: boolean;
}

interface UserFortunePandaAccount {
  username: string;
  password: string;
  balance?: number;
  lastLogin?: Date;
}

class FortunePandaService {
  private config: FortunePandaConfig;
  private adminSession: FortunePandaSession | null = null;
  private userSessions: Map<string, FortunePandaSession> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.config = {
      agentName: process.env.FORTUNE_AGENT_USER || process.env.FORTUNE_PANDA_AGENT_NAME || 'agent01',
      agentPasswd: process.env.FORTUNE_AGENT_PASS || process.env.FORTUNE_PANDA_AGENT_PASSWORD || '123456',
      baseUrl: process.env.FORTUNE_API_URL || process.env.FORTUNE_PANDA_BASE_URL || 'http://demo.fortunepanda.vip:8033/ws/service.ashx'
    };
  }

  // Initialize the service with auto-login and scheduling
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🎰 Initializing Fortune Panda Service...');
    
    try {
      // Auto-login on startup
      const loginResult = await this.adminLogin();
      if (!loginResult.success) {
        console.warn('⚠️ Fortune Panda auto-login failed, but continuing with service setup');
      }
      
      // Set up session refresh every 12 hours
      this.setupSessionRefresh();
      
      this.isInitialized = true;
      console.log('✅ Fortune Panda Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Fortune Panda Service:', error);
      // Don't throw error, just log it and continue
      this.isInitialized = true; // Mark as initialized to prevent retries
    }
  }

  // Auto-login method for startup
  private async autoLogin(): Promise<void> {
    try {
      console.log('🔐 Auto-logging into Fortune Panda...');
      const result = await this.adminLogin();
      
      if (result.success) {
        console.log('✅ Fortune Panda agent auto-login successful');
      } else {
        console.error('❌ Fortune Panda agent auto-login failed:', result.message);
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('❌ Auto-login error:', error);
      throw error;
    }
  }

  // Setup session refresh every 30 minutes (more aggressive)
  private setupSessionRefresh(): void {
    const refreshIntervalMs = parseInt(process.env.SESSION_REFRESH_INTERVAL || '1800000'); // 30 minutes
    
    this.refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Refreshing Fortune Panda agent session...');
        await this.autoLogin();
        console.log('✅ Session refreshed successfully');
      } catch (error) {
        console.error('❌ Session refresh failed:', error);
      }
    }, refreshIntervalMs);
    
    console.log(`⏰ Session refresh scheduled every ${refreshIntervalMs / 1000 / 60} minutes`);
  }


  // Cleanup intervals on shutdown
  cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log('🧹 Fortune Panda Service cleanup completed');
  }

  // Generate MD5 hash
  private generateMD5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Get timestamp in seconds (as per API documentation)
  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  // Get timestamp in milliseconds
  private getLoginTimestamp(): number {
    return Date.now();
  }

  // Generate signature for API calls (exact format from documentation)
  private generateSignature(agentName: string, time: number, agentKey: string): string {
    // Convert all strings to lowercase as per documentation
    const agentNameLower = agentName.toLowerCase();
    const timeLower = time.toString().toLowerCase();
    const agentKeyLower = agentKey.toLowerCase();
    
    // Concatenate: agentName + time + agentKey (all lowercase)
    const raw = agentNameLower + timeLower + agentKeyLower;
    return this.generateMD5(raw);
  }

  // Make API request to Fortune Panda
  private async makeRequest(action: string, params: Record<string, any> = {}, useDirect: boolean = false): Promise<any> {
    try {
      let url: string;
      
      if (useDirect) {
        // Use direct API call during initialization
        url = this.config.baseUrl;
      } else {
        // Use the proxy route to avoid CORS issues for regular operations
        url = `http://localhost:3001/api?action=${action}&${new URLSearchParams(params).toString()}`;
      }
      
      const response = await axios.post(url, null, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
        ...(useDirect && {
          params: {
            action,
            ...params
          }
        })
      });
      
      return response.data;
    } catch (error) {
      console.error('Fortune Panda API Error:', error);
      throw error;
    }
  }

  // Check if admin session is valid (with 5-minute buffer)
  private isAdminSessionValid(): boolean {
    if (!this.adminSession) return false;
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return this.adminSession.isActive && (now + bufferTime) < this.adminSession.expiresAt;
  }

  // Check if user session is valid
  private isUserSessionValid(userId: string): boolean {
    const session = this.userSessions.get(userId);
    if (!session) return false;
    return session.isActive && Date.now() < session.expiresAt;
  }

  // Admin login to Fortune Panda
  async adminLogin(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Check if we already have a valid session
      if (this.isAdminSessionValid()) {
        return {
          success: true,
          message: 'Admin already logged in',
          data: { agentKey: this.adminSession!.agentKey }
        };
      }

      // Skip initialization check to avoid infinite loop
      // Just attempt direct login

      const timestamp = this.getTimestamp();
      const agentPasswdMD5 = this.generateMD5(this.config.agentPasswd);
      
      const params = {
        agentName: this.config.agentName,
        agentPasswd: agentPasswdMD5,
        time: timestamp
      };
      
      console.log('Admin login params:', params);
      
      const result = await this.makeRequest('agentLogin', params, true);
      
      console.log('Admin login result:', result);
      
      if (result && result.code === '200') {
        const agentKey = result.agentkey || result.agentKey;
        
        if (!agentKey) {
          throw new Error('No agentKey returned from login');
        }
        
        // Cache the session for 1 hour (more conservative)
        this.adminSession = {
          agentKey,
          expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
          isActive: true
        };
        
        console.log('Admin login successful, agentKey:', agentKey);
        
        return {
          success: true,
          message: 'Admin login successful',
          data: { 
            agentKey, 
            balance: result.Balance,
            result 
          }
        };
      } else {
        throw new Error(result?.msg || 'Admin login failed');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Admin login failed'
      };
    }
  }

  // Get game list (requires admin session)
  async getGameList(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Initialize service if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Always check session validity and re-login if needed
      if (!this.isAdminSessionValid()) {
        console.log('🔄 Session invalid, attempting re-login...');
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          console.error('❌ Re-login failed:', loginResult.message);
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('getgamelist', params);
      
      return {
        success: true,
        message: 'Game list retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('Get game list error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get game list'
      };
    }
  }

  // Create Fortune Panda user account
  async createFortunePandaUser(username: string, password: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const userPasswdMD5 = this.generateMD5(password);
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        passwd: userPasswdMD5,
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('registerUser', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Fortune Panda user created successfully',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to create Fortune Panda user'
        };
      }
    } catch (error) {
      console.error('Create Fortune Panda user error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create Fortune Panda user'
      };
    }
  }

  // Query user info from Fortune Panda
  async queryUserInfo(username: string, password: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const userPasswdMD5 = this.generateMD5(password);
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        passwd: userPasswdMD5,
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('queryInfo', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'User info retrieved successfully',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to get user info'
        };
      }
    } catch (error) {
      console.error('Query user info error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get user info'
      };
    }
  }

  // Enter game
  async enterGame(username: string, password: string, kindId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Always check session validity and re-login if needed
      if (!this.isAdminSessionValid()) {
        console.log('🔄 Session invalid, attempting re-login...');
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          console.error('❌ Re-login failed:', loginResult.message);
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const userPasswdMD5 = this.generateMD5(password);
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        passwd: userPasswdMD5,
        agentName: this.config.agentName,
        kindId,
        time,
        sign
      };

      const result = await this.makeRequest('entergame', params);
      
      console.log('Fortune Panda enterGame result:', JSON.stringify(result, null, 2));
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Game entry successful',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to enter game'
        };
      }
    } catch (error) {
      console.error('Enter game error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to enter game'
      };
    }
  }

  // Recharge user account
  async rechargeUser(username: string, amount: number): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        amount: amount.toString(),
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('recharge', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Recharge successful',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to recharge account'
        };
      }
    } catch (error) {
      console.error('Recharge error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to recharge account'
      };
    }
  }

  // Redeem from user account
  async redeemUser(username: string, amount: number): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        amount: amount.toString(),
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('redeem', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Redeem successful',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to redeem from account'
        };
      }
    } catch (error) {
      console.error('Redeem error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to redeem from account'
      };
    }
  }

  // Generate Fortune Panda username format: {username}+ace0091
  generateFortunePandaUsername(username: string): string {
    return `${username}+ace0091`;
  }

  // Generate random password for Fortune Panda account
  generateFortunePandaPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Get admin session status
  getAdminSessionStatus(): { isLoggedIn: boolean; expiresAt?: number } {
    return {
      isLoggedIn: this.isAdminSessionValid(),
      expiresAt: this.adminSession?.expiresAt
    };
  }

  // Force re-login (useful for debugging)
  async forceReLogin(): Promise<{ success: boolean; message: string; data?: any }> {
    console.log('🔄 Force re-login requested...');
    this.adminSession = null;
    return await this.adminLogin();
  }

  // Logout admin
  logoutAdmin(): void {
    this.adminSession = null;
  }

  // Logout user
  logoutUser(userId: string): void {
    this.userSessions.delete(userId);
  }

  // Change user password (from API documentation)
  async changeUserPassword(username: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const oldPasswdMD5 = this.generateMD5(oldPassword);
      const newPasswdMD5 = this.generateMD5(newPassword);
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        account: username,
        passwd: oldPasswdMD5,
        passwdNew: newPasswdMD5,
        agentName: this.config.agentName,
        time,
        sign
      };

      const result = await this.makeRequest('changePasswd', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Password changed successfully',
          data: result
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to change password'
        };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change password'
      };
    }
  }

  // Get trade records (from API documentation)
  async getTradeRecords(username: string, fromDate: string, toDate: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        agentName: this.config.agentName,
        account: username,
        fromDate,
        toDate,
        time,
        sign
      };

      const result = await this.makeRequest('getTradeRecord', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Trade records retrieved successfully',
          data: result.data
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to get trade records'
        };
      }
    } catch (error) {
      console.error('Get trade records error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get trade records'
      };
    }
  }

  // Get JP records (from API documentation)
  async getJPRecords(username: string, fromDate: string, toDate: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        agentName: this.config.agentName,
        account: username,
        fromDate,
        toDate,
        time,
        sign
      };

      const result = await this.makeRequest('getJpRecord', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'JP records retrieved successfully',
          data: result.data
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to get JP records'
        };
      }
    } catch (error) {
      console.error('Get JP records error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get JP records'
      };
    }
  }

  // Get game records (from API documentation)
  async getGameRecords(username: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      const time = this.getTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.adminSession!.agentKey
      );

      const params = {
        agentName: this.config.agentName,
        account: username,
        time,
        sign
      };

      const result = await this.makeRequest('getGameRecord', params);
      
      if (result && result.code === '200') {
        return {
          success: true,
          message: 'Game records retrieved successfully',
          data: result.data
        };
      } else {
        return {
          success: false,
          message: result?.msg || 'Failed to get game records'
        };
      }
    } catch (error) {
      console.error('Get game records error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get game records'
      };
    }
  }

  // Get all users with Fortune Panda information
  async getAllUsersWithFortunePandaInfo(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.isAdminSessionValid()) {
        const loginResult = await this.adminLogin();
        if (!loginResult.success) {
          return loginResult;
        }
      }

      // Import User model dynamically to avoid circular dependency
      const { default: User } = await import('../models/User');
      
      // Get all users from MongoDB
      const users = await User.find({}, 'username email firstName lastName phoneNumber fortunePandaUsername fortunePandaBalance fortunePandaLastSync createdAt lastLogin').lean();
      
      // Get Fortune Panda info for each user
      const usersWithFortunePandaInfo = await Promise.all(
        users.map(async (user: any) => {
          try {
            if (user.fortunePandaUsername) {
              const fortunePandaInfo = await this.queryUserInfo(user.fortunePandaUsername, 'temp');
              return {
                id: user._id,
                account: user.fortunePandaUsername,
                nickname: user.firstName + ' ' + user.lastName,
                balance: fortunePandaInfo.success ? fortunePandaInfo.data?.userbalance || '0.00' : '0.00',
                registerDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
                lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : 'N/A',
                manager: 'Admin',
                status: 'Active'
              };
            } else {
              return {
                id: user._id,
                account: user.username,
                nickname: user.firstName + ' ' + user.lastName,
                balance: '0.00',
                registerDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
                lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : 'N/A',
                manager: 'Admin',
                status: 'Active'
              };
            }
          } catch (error) {
            console.error(`Error getting Fortune Panda info for user ${user.username}:`, error);
            return {
              id: user._id,
              account: user.username,
              nickname: user.firstName + ' ' + user.lastName,
              balance: '0.00',
              registerDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
              lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : 'N/A',
              manager: 'Admin',
              status: 'Active'
            };
          }
        })
      );

      return {
        success: true,
        message: 'Users retrieved successfully',
        data: usersWithFortunePandaInfo
      };
    } catch (error) {
      console.error('Get all users error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get users'
      };
    }
  }
}

export default new FortunePandaService();
