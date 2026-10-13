import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import logger from '../utils/logger';

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
  private loginInFlight: Promise<{ success: boolean; message: string; data?: any }> | null = null;
  private readonly SESSION_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes buffer
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours (more aggressive than 12h)
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds base delay

  constructor() {
    this.config = {
      agentName: process.env.FORTUNE_PANDA_AGENT_NAME || '',
      agentPassword: process.env.FORTUNE_PANDA_AGENT_PASSWORD || '',
      apiUrl: process.env.FORTUNE_PANDA_API_URL || ''
    };

    if (!this.config.agentName || !this.config.agentPassword || !this.config.apiUrl) {
      logger.warn('⚠️ FORTUNE_PANDA_AGENT_NAME, FORTUNE_PANDA_AGENT_PASSWORD, or FORTUNE_PANDA_API_URL not set in environment variables');
    }
  }

  // Helper method to sleep/delay
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper method to check if error is retryable (network/timeout errors)
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorCode = error.code || error.errno;
    const errorMessage = error.message || '';
    
    // Network errors that should be retried
    const retryableCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'];
    const retryableMessages = ['timeout', 'network', 'connection'];
    
    return retryableCodes.includes(errorCode) || 
           retryableMessages.some(msg => errorMessage.toLowerCase().includes(msg));
  }

  // Generic retry wrapper for API calls (keeps original API call structure intact)
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    operationName: string,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // If it's the last attempt or error is not retryable, throw
        if (attempt === retries || !this.isRetryableError(error)) {
          throw error;
        }
        
        // Calculate exponential backoff delay
        const delay = this.RETRY_DELAY * Math.pow(2, attempt);
        logger.debug(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`, error.message);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  // Initialize the service with auto-login and scheduling
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    logger.init('🎰 Initializing Agent Login Service...');
    
    try {
      // Auto-login on startup
      const loginResult = await this.loginAgent();
      if (!loginResult.success) {
        logger.warn('⚠️ Agent auto-login failed, but continuing with service setup');
      }
      
      // Set up session refresh
      this.setupSessionRefresh();
      
      this.isInitialized = true;
      logger.success('✅ Agent Login Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Agent Login Service:', error);
      this.isInitialized = true; // Mark as initialized to prevent retries
    }
  }

  // Setup session refresh every 6 hours
  private setupSessionRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        logger.debug('🔄 Refreshing agent session...');
        await this.loginAgent();
        logger.debug('✅ Session refreshed successfully');
      } catch (error) {
        logger.error('❌ Session refresh failed:', error);
      }
    }, this.REFRESH_INTERVAL);
    
    logger.info(`⏰ Session refresh scheduled every ${this.REFRESH_INTERVAL / 1000 / 60 / 60} hours`);
  }

  // Cleanup intervals on shutdown
  cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    logger.debug('🧹 Agent Login Service cleanup completed');
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

  // Login agent and get agentKey.
  // Concurrent callers share one login — a second login invalidates the key the first one just received.
  async loginAgent(): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.loginInFlight) {
      return this.loginInFlight;
    }

    this.loginInFlight = this.performAgentLogin();
    try {
      return await this.loginInFlight;
    } finally {
      this.loginInFlight = null;
    }
  }

  private async performAgentLogin(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      logger.debug('🔐 Logging into agent...');
      
      const time = this.getCurrentTimestamp();
      const agentPasswdMD5 = this.generateMD5(this.config.agentPassword);
      
      const params = {
        action: 'agentLogin',
        agentName: this.config.agentName,
        agentPasswd: agentPasswdMD5,
        time
      };
      
      logger.debug('Agent login params:', { ...params, agentPasswd: '[HIDDEN]' });
      
      // Use retry logic for network/timeout errors, but keep exact API call structure
      const response = await this.retryRequest(
        async () => {
          // Generate fresh timestamp for each retry attempt
          const retryTime = this.getCurrentTimestamp();
          const retryParams = {
            action: 'agentLogin',
            agentName: this.config.agentName,
            agentPasswd: agentPasswdMD5,
            time: retryTime
          };
          
          return await axios.post(this.config.apiUrl, null, {
            params: retryParams,
            timeout: 30000,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          });
        },
        'Agent login'
      );
      
      logger.debug('Agent login response:', response.data);
      
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
        
        logger.debug('✅ Agent login successful, agentKey cached');
        
        return {
          success: true,
          message: 'Agent login successful',
          data: { 
            agentKey, 
            balance: response.data.balance || response.data.Balance || '0.00',
            expiresAt: this.agentSession.expiresAt
          }
        };
      } else {
        throw new Error(response.data?.msg || 'Agent login failed');
      }
    } catch (error) {
      logger.error('❌ Agent login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Agent login failed'
      };
    }
  }

  private isSignatureError(body: any): boolean {
    if (!body || typeof body !== 'object') return false;
    const code = String(body.code ?? '');
    const msg = String(body.msg ?? body.message ?? '').toLowerCase();
    return code === '201' || msg.includes('invalid sign') || msg.includes('signature');
  }

  private extractGameArray(body: any): any[] | null {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.data?.data)) return body.data.data;
    return null;
  }

  private async requestGameList(agentKey: string): Promise<any> {
    const time = this.getCurrentTimestamp();
    const sign = this.generateSignature(this.config.agentName, time, agentKey);
    const response = await axios.post(this.config.apiUrl, null, {
      params: {
        action: 'getgamelist',
        agentName: this.config.agentName,
        time,
        sign
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    return response.data;
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
        logger.debug('🔄 Session invalid or expired, attempting re-login...');
        const loginResult = await this.loginAgent();
        if (!loginResult.success) {
          logger.error('❌ Re-login failed:', loginResult.message);
          return {
            success: false,
            message: `Failed to authenticate agent: ${loginResult.message}`
          };
        }
      }

      let body = await this.requestGameList(this.agentSession!.agentKey);
      logger.debug('GetGameList response:', body);

      // A rejected signature is not an empty lobby — log in again and ask once more.
      if (this.isSignatureError(body)) {
        logger.debug('🔄 API returned session error, forcing re-login...');
        const loginResult = await this.loginAgent();
        if (!loginResult.success || !this.agentSession?.agentKey) {
          return {
            success: false,
            message: loginResult.message || 'Failed to authenticate agent'
          };
        }
        body = await this.requestGameList(this.agentSession.agentKey);
        logger.debug('GetGameList retry response:', body);
      }

      const games = this.extractGameArray(body);
      if (!games) {
        return {
          success: false,
          message: body?.msg || body?.message || 'Failed to get game list'
        };
      }

      return {
        success: true,
        message: 'Game list retrieved successfully',
        data: games
      };
    } catch (error) {
      logger.error('❌ Get game list error:', error);
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
    logger.debug('🔄 Force re-login requested...');
    this.agentSession = null;
    return await this.loginAgent();
  }

  // Logout agent
  logoutAgent(): void {
    this.agentSession = null;
    logger.debug('🔓 Agent logged out');
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
