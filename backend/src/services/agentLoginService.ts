import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AgentSession {
  agentKey: string;
  expiresAt: number;
  isActive: boolean;
  lastUsed: number;
}

interface AgentConfig {
  agentName: string;
  agentPassword: string;
  apiUrl: string;
}

class AgentLoginService {
  private config: AgentConfig;
  private agentSession: AgentSession | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private readonly SESSION_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes buffer
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours (more aggressive than 12h)

  constructor() {
    this.config = {
      agentName: process.env.AGENT_NAME || process.env.FORTUNE_PANDA_AGENT_NAME || 'agent01',
      agentPassword: process.env.AGENT_PASSWORD || process.env.FORTUNE_PANDA_AGENT_PASSWORD || '123456',
      apiUrl: process.env.AGENT_API_URL || process.env.FORTUNE_PANDA_API_URL || 'http://demo.fortunepanda.vip:8033/ws/service.ashx'
    };
  }

  // Initialize the service with auto-login and scheduling
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🎰 Initializing Agent Login Service...');
    
    try {
      // Auto-login on startup
      const loginResult = await this.loginAgent();
      if (!loginResult.success) {
        console.warn('⚠️ Agent auto-login failed, but continuing with service setup');
      }
      
      // Set up session refresh
      this.setupSessionRefresh();
      
      this.isInitialized = true;
      console.log('✅ Agent Login Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Agent Login Service:', error);
      this.isInitialized = true; // Mark as initialized to prevent retries
    }
  }

  // Setup session refresh every 6 hours
  private setupSessionRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Refreshing agent session...');
        await this.loginAgent();
        console.log('✅ Session refreshed successfully');
      } catch (error) {
        console.error('❌ Session refresh failed:', error);
      }
    }, this.REFRESH_INTERVAL);
    
    console.log(`⏰ Session refresh scheduled every ${this.REFRESH_INTERVAL / 1000 / 60 / 60} hours`);
  }

  // Cleanup intervals on shutdown
  cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log('🧹 Agent Login Service cleanup completed');
  }

  // Generate MD5 hash
  private generateMD5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Get current timestamp in milliseconds
  private getCurrentTimestamp(): number {
    return Date.now();
  }

  // Generate signature for API calls
  private generateSignature(agentName: string, time: number, agentKey: string): string {
    const agentNameLower = agentName.toLowerCase();
    const timeStr = time.toString();
    const agentKeyLower = agentKey.toLowerCase();
    
    const raw = agentNameLower + timeStr + agentKeyLower;
    return this.generateMD5(raw);
  }

  // Check if agent session is valid
  private isSessionValid(): boolean {
    if (!this.agentSession) return false;
    const now = Date.now();
    return this.agentSession.isActive && (now + this.SESSION_BUFFER_TIME) < this.agentSession.expiresAt;
  }

  // Login agent and get agentKey
  async loginAgent(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔐 Logging into agent...');
      
      const time = this.getCurrentTimestamp();
      const agentPasswdMD5 = this.generateMD5(this.config.agentPassword);
      
      const params = {
        action: 'agentLogin',
        agentName: this.config.agentName,
        agentPasswd: agentPasswdMD5,
        time
      };
      
      console.log('Agent login params:', { ...params, agentPasswd: '[HIDDEN]' });
      
      const response = await axios.post(this.config.apiUrl, null, {
        params,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      console.log('Agent login response:', response.data);
      
      if (response.data && response.data.code === '200') {
        const agentKey = response.data.agentkey || response.data.agentKey;
        
        if (!agentKey) {
          throw new Error('No agentKey returned from login');
        }
        
        // Cache the session for 12 hours
        this.agentSession = {
          agentKey,
          expiresAt: Date.now() + (12 * 60 * 60 * 1000), // 12 hours
          isActive: true,
          lastUsed: Date.now()
        };
        
        console.log('✅ Agent login successful, agentKey cached');
        
        return {
          success: true,
          message: 'Agent login successful',
          data: { 
            agentKey, 
            balance: response.data.Balance,
            expiresAt: this.agentSession.expiresAt
          }
        };
      } else {
        throw new Error(response.data?.msg || 'Agent login failed');
      }
    } catch (error) {
      console.error('❌ Agent login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Agent login failed'
      };
    }
  }

  // Get game list with automatic session management
  async getGameList(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Initialize service if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if we have a valid session, if not, login
      if (!this.isSessionValid()) {
        console.log('🔄 Session invalid or expired, attempting re-login...');
        const loginResult = await this.loginAgent();
        if (!loginResult.success) {
          console.error('❌ Re-login failed:', loginResult.message);
        return {
          success: false,
          message: `Failed to authenticate agent: ${loginResult.message}`
        };
        }
      }

      // Generate fresh timestamp and signature
      const time = this.getCurrentTimestamp();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentSession!.agentKey
      );

      const params = {
        action: 'getgamelist',
        agentName: this.config.agentName,
        time,
        sign
      };

      console.log('GetGameList params:', { ...params, sign: '[HIDDEN]' });

      const response = await axios.post(this.config.apiUrl, null, {
        params,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      console.log('GetGameList response:', response.data);

      // Check if the response indicates session issues
      if (response.data && (response.data.code === '201' || response.data.msg?.includes('invalid sign'))) {
        console.log('🔄 API returned session error, forcing re-login...');
        // Force re-login and retry once
        await this.loginAgent();
        
        // Retry with new session
        const newTime = this.getCurrentTimestamp();
        const newSign = this.generateSignature(
          this.config.agentName,
          newTime,
          this.agentSession!.agentKey
        );

        const retryParams = {
          action: 'getgamelist',
          agentName: this.config.agentName,
          time: newTime,
          sign: newSign
        };

        const retryResponse = await axios.post(this.config.apiUrl, null, {
          params: retryParams,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        });

        return {
          success: true,
          message: 'Game list retrieved successfully (after re-login)',
          data: retryResponse.data
        };
      }

      return {
        success: true,
        message: 'Game list retrieved successfully',
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get game list error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get game list'
      };
    }
  }

  // Get session status
  getSessionStatus(): { isLoggedIn: boolean; expiresAt?: number; lastUsed?: number } {
    return {
      isLoggedIn: this.isSessionValid(),
      expiresAt: this.agentSession?.expiresAt,
      lastUsed: this.agentSession?.lastUsed
    };
  }

  // Force re-login (useful for debugging)
  async forceReLogin(): Promise<{ success: boolean; message: string; data?: any }> {
    console.log('🔄 Force re-login requested...');
    this.agentSession = null;
    return await this.loginAgent();
  }

  // Logout agent
  logoutAgent(): void {
    this.agentSession = null;
    console.log('🔓 Agent logged out');
  }

  // Get agent configuration (without sensitive data)
  getConfig(): { agentName: string; apiUrl: string } {
    return {
      agentName: this.config.agentName,
      apiUrl: this.config.apiUrl
    };
  }
}

export default new AgentLoginService();
