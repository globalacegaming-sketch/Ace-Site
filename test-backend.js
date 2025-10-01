const axios = require('axios');

async function testBackend() {
  try {
    console.log('🧪 Testing backend connection...');
    
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check:', healthResponse.data);
    
    // Test if Fortune Panda service is working
    const agentResponse = await axios.post('http://localhost:3001/api/health/agent/relogin');
    console.log('✅ Agent service:', agentResponse.data);
    
  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testBackend();
