import request from 'supertest';
import { startExpressServer } from '../express-server.js';
import { Server } from 'http';

// Skip the mocking and just test the health endpoint
describe('Express Server', () => {
  let server: Server;
  
  beforeAll(() => {
    // Start server
    server = startExpressServer();
  });
  
  afterAll((done) => {
    // Clean up server
    server.close(done);
  });
  
  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await request(server).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});