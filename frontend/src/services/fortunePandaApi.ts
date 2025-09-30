import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Fortune Panda API service for frontend
class FortunePandaAPI {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Admin operations
  async adminLogin() {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/admin/login`, {}, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getGameList() {
    try {
      const response = await axios.get(`${API_BASE_URL}/fortune-panda/games`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createFortunePandaUser(username: string, password: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/users`, {
        username,
        password
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async queryUserInfo(username: string, password: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/fortune-panda/users/${username}?password=${password}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async enterGame(username: string, password: string, kindId: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/games/enter`, {
        username,
        password,
        kindId
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async rechargeUser(username: string, amount: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/users/${username}/recharge`, {
        amount
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async redeemUser(username: string, amount: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/users/${username}/redeem`, {
        amount
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getAdminStatus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/fortune-panda/admin/status`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async logoutAdmin() {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda/admin/logout`, {}, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // User operations
  async getUserAccount() {
    try {
      const response = await axios.get(`${API_BASE_URL}/fortune-panda-user/account`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getUserGames() {
    try {
      const response = await axios.get(`${API_BASE_URL}/fortune-panda-user/games`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async enterUserGame(kindId: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/fortune-panda-user/games/enter`, {
        kindId
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default new FortunePandaAPI();