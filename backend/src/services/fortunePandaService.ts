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

class FortunePandaService {
  private config: FortunePandaConfig;
  private agentKeyCache: string | null = null;
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
      await this.loginAgent();
      
      // Set up session refresh every 6 hours (more frequent than 12h)
      this.setupSessionRefresh();
      
      this.isInitialized = true;
      console.log('✅ Fortune Panda Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Fortune Panda Service:', error);
      // Don't throw error, just log it and continue
      this.isInitialized = true; // Mark as initialized to prevent retries
    }
  }

  // Setup session refresh every 6 hours (as per specification)
  private setupSessionRefresh(): void {
    const refreshIntervalMs = 6 * 60 * 60 * 1000; // 6 hours (less than 12h as recommended)
    
    this.refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing Fortune Panda agent session...');
        await this.loginAgent();
        console.log('✅ Session refreshed successfully');
      } catch (error) {
        console.error('❌ Session refresh failed:', error);
      }
    }, refreshIntervalMs);
    
    console.log(`⏰ Session refresh scheduled every 6 hours (background auto-login)`);
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
  public generateMD5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Get full FortunePanda username with _GAGame suffix
  // FortunePanda automatically appends _GAGame when creating accounts
  // So we need to append it when querying, but store without it in database
  public getFullFortunePandaUsername(username: string): string {
    // If username already ends with _GAGame, return as is
    if (username.endsWith('_GAGame')) {
      return username;
    }
    // Otherwise, append _GAGame
    return `${username}_GAGame`;
  }

  // Get current timestamp in milliseconds (as per your specification)
  private getCurrentTimestamp(): number {
    return Date.now();
  }

  // Generate signature for API calls (exact format from Fortune Panda Demo API)
  private generateSignature(agentName: string, time: number, agentKey: string): string {
    // Exact format from demo: md5(agentName.toLowerCase() + time + agentKey.toLowerCase())
    const agentNameLower = agentName.toLowerCase();
    const timeString = time.toString();
    const agentKeyLower = agentKey.toLowerCase();
    
    // Concatenate: agentName.toLowerCase() + time + agentKey.toLowerCase()
    const raw = agentNameLower + timeString + agentKeyLower;
    // Signature generation for API calls
    return this.generateMD5(raw);
  }

  // Login agent and cache agentKey (exact implementation as per specification)
  private async loginAgent(): Promise<void> {
    try {
      console.log('🔐 Logging into Fortune Panda agent...');
      
      // Generate fresh timestamp (UNIX timestamp in milliseconds)
      const time = Date.now();
      
      // Generate MD5 hash of agent password
      const passwdMd5 = this.generateMD5(this.config.agentPasswd);
      
      // Agent login request
      
      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'agentLogin',
          agentName: this.config.agentName,
          agentPasswd: passwdMd5,
          time
        },
        timeout: 30000
      });
      
      // Process agent login response
      
      if (response.data && response.data.code === '200') {
        const agentKey = response.data.agentKey || response.data.agentkey;
        
        if (!agentKey) {
          throw new Error('No agentKey returned from login');
        }
        
        // Cache the agentKey (new key each time)
        this.agentKeyCache = agentKey;
        // Agent login successful
      } else {
        throw new Error(response.data?.msg || 'Agent login failed');
      }
    } catch (error) {
      console.error('❌ Agent login error:', error);
      throw error;
    }
  }

  // Get game list (exact implementation as per specification)
  async getGameList(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Initialize service if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if we have a cached agentKey, if not login
      if (!this.agentKeyCache) {
        console.log('🔄 No cached agentKey, logging in...');
        await this.loginAgent();
      }

      // Generate fresh timestamp (UNIX timestamp in milliseconds)
      const time = Date.now();
      
      // Generate sign: md5(agentName.toLowerCase() + time + agentKey.toLowerCase())
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      // Get game list request

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'getgamelist',
        agentName: this.config.agentName,
        time,
        sign
        },
        timeout: 30000
      });

      // Process game list response
      
      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
      return {
        success: true,
        message: 'Game list retrieved successfully',
          data: response.data.data // Return the games array
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201 || response.data.msg?.includes('invalid sign'))) {
        // AgentKey expired or invalid, force re-login and retry
        // AgentKey expired, retrying with fresh login
        await this.loginAgent();
        
        // Retry with fresh agentKey and fresh timestamp
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        // Retry game list request

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'getgamelist',
            agentName: this.config.agentName,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        // Process retry response

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'Game list retrieved successfully after retry',
            data: retryResponse.data.data // Return the games array
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to get game list after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to get game list'
        };
      }
    } catch (error) {
      console.error('❌ Get game list error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get game list'
      };
    }
  }

  // Create Fortune Panda user account (Demo API format - {firstname}_Aces9F)
  async createFortunePandaUser(firstName: string, password: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Check if we have a cached agentKey, if not login
      if (!this.agentKeyCache) {
        console.log('🔄 No cached agentKey, logging in...');
        await this.loginAgent();
      }

      // Generate Fortune Panda username: {firstname}_Aces9F
      const account = `${firstName}_Aces9F`;
      const time = Date.now();
      const passwdMd5 = this.generateMD5(password);
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'registerUser',
          account,
          passwd: passwdMd5,
        agentName: this.config.agentName,
        time,
        sign
        },
        timeout: 30000
      });

      // Process user creation response
      
      if (response.data && response.data.code === '200') {
        return {
          success: true,
          message: 'Fortune Panda user created successfully',
          data: {
            account,
            password,
            ...response.data
          }
        };
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to create Fortune Panda user'
        };
      }
    } catch (error) {
      console.error('❌ Create Fortune Panda user error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create Fortune Panda user'
      };
    }
  }

  // Query user info from Fortune Panda (Demo API format - for balance polling every 20s)
  async queryUserInfo(account: string, passwdMd5: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Check if we have a cached agentKey, if not login
      if (!this.agentKeyCache) {
        console.log('🔄 No cached agentKey, logging in...');
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      console.log('🔍 FortunePanda queryInfo request:', {
        action: 'queryInfo',
        account,
        accountLength: account?.length,
        passwdLength: passwdMd5?.length,
        agentName: this.config.agentName,
        time,
        signLength: sign?.length
      });

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'queryInfo',
          account,
          passwd: passwdMd5,
        agentName: this.config.agentName,
          time,
          sign
        },
        timeout: 30000
      });

      console.log('📥 FortunePanda queryInfo response:', {
        code: response.data?.code,
        msg: response.data?.msg,
        hasUserbalance: !!response.data?.userbalance,
        hasAgentBalance: !!response.data?.agentBalance
      });

      // Process user info query response
      
      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        // User info retrieved successfully
        return {
          success: true,
          message: 'User info retrieved successfully',
          data: {
            userbalance: response.data.userbalance || response.data.userBalance,
            agentBalance: response.data.agentBalance || response.data.agentbalance,
            gameId: response.data.gameId || response.data.gameid,
            ...response.data
          }
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201 || response.data.msg?.includes('invalid sign'))) {
        // AgentKey expired, re-login and retry
        // AgentKey expired, retrying with fresh login
        await this.loginAgent();
        
        // Retry with fresh agentKey
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'queryInfo',
            account,
            passwd: passwdMd5,
            agentName: this.config.agentName,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        // Process retry response

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          // User info retrieved successfully after retry
          return {
            success: true,
            message: 'User info retrieved successfully',
            data: {
              userbalance: retryResponse.data.userbalance || retryResponse.data.userBalance,
              agentBalance: retryResponse.data.agentBalance || retryResponse.data.agentbalance,
              gameId: retryResponse.data.gameId || retryResponse.data.gameid,
              ...retryResponse.data
            }
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to get user info after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to get user info'
        };
      }
    } catch (error) {
      console.error('❌ Query user info error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get user info'
      };
    }
  }

  // Enter game (Demo API format - redirect to game via entergame)
  async enterGame(account: string, passwdMd5: string, kindId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Check if we have a cached agentKey, if not login
      if (!this.agentKeyCache) {
        console.log('🔄 No cached agentKey, logging in...');
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'entergame',
          account,
          passwd: passwdMd5,
        agentName: this.config.agentName,
        kindId,
        time,
        sign
        },
        timeout: 30000
      });

      // Process game entry response
      
      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        // Game entry successful
        return {
          success: true,
          message: 'Game entry successful',
          data: {
            webLoginUrl: response.data.webLoginUrl,
            ...response.data
          }
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201 || response.data.msg?.includes('invalid sign'))) {
        // AgentKey expired, re-login and retry
        // AgentKey expired, retrying with fresh login
        await this.loginAgent();
        
        // Retry with fresh agentKey
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
        this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'entergame',
            account,
            passwd: passwdMd5,
        agentName: this.config.agentName,
            kindId,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        // Process retry response

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          // Game entry successful after retry
        return {
          success: true,
            message: 'Game entry successful',
            data: {
              webLoginUrl: retryResponse.data.webLoginUrl,
              ...retryResponse.data
            }
        };
      } else {
        return {
          success: false,
            message: retryResponse.data?.msg || 'Failed to enter game after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to enter game'
        };
      }
    } catch (error) {
      console.error('❌ Enter game error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to enter game'
      };
    }
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

  // Agent Deposit (Load money to user account)
  async agentDeposit(account: string, passwdMd5: string, amount: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.agentKeyCache) {
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'agentDeposit',
          account,
          passwd: passwdMd5,
          agentName: this.config.agentName,
          amount,
          time,
          sign
        },
        timeout: 30000
      });

      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          message: 'Deposit successful',
          data: response.data
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201)) {
        await this.loginAgent();
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'agentDeposit',
            account,
            passwd: passwdMd5,
            agentName: this.config.agentName,
            amount,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'Deposit successful',
            data: retryResponse.data
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to deposit after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to deposit'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to deposit'
      };
    }
  }

  // Agent Redeem (Withdraw money from user account)
  async agentRedeem(account: string, passwdMd5: string, amount: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.agentKeyCache) {
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'agentRedeem',
          account,
          passwd: passwdMd5,
          agentName: this.config.agentName,
          amount,
          time,
          sign
        },
        timeout: 30000
      });

      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          message: 'Redeem successful',
          data: response.data
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201)) {
        await this.loginAgent();
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'agentRedeem',
            account,
            passwd: passwdMd5,
            agentName: this.config.agentName,
            amount,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'Redeem successful',
            data: retryResponse.data
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to redeem after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to redeem'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to redeem'
      };
    }
  }

  // Get Trade Record
  async getTradeRecord(account: string, passwdMd5: string, fromDate: string, toDate: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.agentKeyCache) {
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'getTradeRecord',
          account,
          passwd: passwdMd5,
          agentName: this.config.agentName,
          fromDate,
          toDate,
          time,
          sign
        },
        timeout: 30000
      });

      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          message: 'Trade records retrieved successfully',
          data: response.data
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201)) {
        await this.loginAgent();
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'getTradeRecord',
            account,
            passwd: passwdMd5,
            agentName: this.config.agentName,
            fromDate,
            toDate,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'Trade records retrieved successfully',
            data: retryResponse.data
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to get trade records after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to get trade records'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get trade records'
      };
    }
  }

  // Get JP Record (Jackpot Record)
  async getJpRecord(account: string, passwdMd5: string, fromDate: string, toDate: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.agentKeyCache) {
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const response = await axios.post(this.config.baseUrl, null, {
        params: {
          action: 'getJpRecord',
          account,
          passwd: passwdMd5,
          agentName: this.config.agentName,
          fromDate,
          toDate,
          time,
          sign
        },
        timeout: 30000
      });

      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          message: 'JP records retrieved successfully',
          data: response.data
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201)) {
        await this.loginAgent();
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: {
            action: 'getJpRecord',
            account,
            passwd: passwdMd5,
            agentName: this.config.agentName,
            fromDate,
            toDate,
            time: retryTime,
            sign: retrySign
          },
          timeout: 30000
        });

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'JP records retrieved successfully',
            data: retryResponse.data
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to get JP records after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to get JP records'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get JP records'
      };
    }
  }

  // Get Game Record
  async getGameRecord(account: string, passwdMd5: string, fromDate: string, toDate: string, kindId?: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.agentKeyCache) {
        await this.loginAgent();
      }

      const time = Date.now();
      const sign = this.generateSignature(
        this.config.agentName,
        time,
        this.agentKeyCache!
      );

      const params: any = {
        action: 'getGameRecord',
        account,
        passwd: passwdMd5,
        agentName: this.config.agentName,
        fromDate,
        toDate,
        time,
        sign
      };

      if (kindId) {
        params.kindId = kindId;
      }

      const response = await axios.post(this.config.baseUrl, null, {
        params,
        timeout: 30000
      });

      if (response.data && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          message: 'Game records retrieved successfully',
          data: response.data
        };
      } else if (response.data && (response.data.code === '201' || response.data.code === 201)) {
        await this.loginAgent();
        const retryTime = Date.now();
        const retrySign = this.generateSignature(
          this.config.agentName,
          retryTime,
          this.agentKeyCache!
        );

        const retryParams: any = {
          action: 'getGameRecord',
          account,
          passwd: passwdMd5,
          agentName: this.config.agentName,
          fromDate,
          toDate,
          time: retryTime,
          sign: retrySign
        };

        if (kindId) {
          retryParams.kindId = kindId;
        }

        const retryResponse = await axios.post(this.config.baseUrl, null, {
          params: retryParams,
          timeout: 30000
        });

        if (retryResponse.data && (retryResponse.data.code === '200' || retryResponse.data.code === 200)) {
          return {
            success: true,
            message: 'Game records retrieved successfully',
            data: retryResponse.data
          };
        } else {
          return {
            success: false,
            message: retryResponse.data?.msg || 'Failed to get game records after retry'
          };
        }
      } else {
        return {
          success: false,
          message: response.data?.msg || 'Failed to get game records'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get game records'
      };
    }
  }
}

export default new FortunePandaService();