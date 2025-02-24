import type { Request, Response, RequestHandler } from 'express';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractFigmaIds, FigmaTreeGenerator } from './figma-api.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema for validating analyze request
const AnalyzeRequestSchema = z.object({
  figmaUrl: z.string().url(),
  depth: z.number().optional()
});

export function startExpressServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Serve OpenAPI spec
  app.get('/openapi.json', (req, res) => {
    try {
      const openApiPath = path.resolve(__dirname, '../openapi.json');
      if (fs.existsSync(openApiPath)) {
        const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
        res.json(openApiSpec);
      } else {
        console.warn('OpenAPI spec file not found at', openApiPath);
        res.status(404).json({ error: 'OpenAPI specification not found' });
      }
    } catch (error) {
      console.error('Error serving OpenAPI spec:', error);
      res.status(500).json({ error: 'Error serving OpenAPI specification' });
    }
  });

  // Serve MCP manifest
  app.get('/mcp.json', (req, res) => {
    try {
      const mcpPath = path.resolve(__dirname, '../mcp.json');
      if (fs.existsSync(mcpPath)) {
        const mcpManifest = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
        
        // Update the server URL dynamically
        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;
        
        // Update API URL
        if (mcpManifest?.api?.url) {
          mcpManifest.api.url = `${baseUrl}/openapi.json`;
        }
        
        res.json(mcpManifest);
      } else {
        console.warn('MCP manifest file not found at', mcpPath);
        res.status(404).json({ error: 'MCP manifest not found' });
      }
    } catch (error) {
      console.error('Error serving MCP manifest:', error);
      res.status(500).json({ error: 'Error serving MCP manifest' });
    }
  });

  // MCP routes
  const analyzeHandler: RequestHandler = async (req, res) => {
    try {
      const { figmaUrl, depth } = AnalyzeRequestSchema.parse(req.body);
      
      // Get Figma API Key from ENV var, or error out
      const figmaApiKey = process.env.FIGMA_API_KEY;
      
      if (!figmaApiKey) {
        res.status(500).json({ error: 'FIGMA_API_KEY not configured on server' });
        return;
      }
      
      // Extract file ID and node ID from URL
      const { fileId, nodeId } = extractFigmaIds(figmaUrl);
      
      if (!fileId) {
        res.status(400).json({ error: 'Could not extract file ID from URL' });
        return;
      }
      
      if (!nodeId) {
        res.status(400).json({ error: 'No node ID specified in URL' });
        return;
      }
      
      // Generate the node tree
      const treeGenerator = new FigmaTreeGenerator(figmaApiKey);
      const tree = await treeGenerator.generateNodeTree(fileId, nodeId, depth);
      
      // Return the tree
      res.json({
        fileId,
        nodeId,
        tree
      });
    } catch (error) {
      console.error('Error analyzing Figma file:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  app.post('/analyze', analyzeHandler);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Start the server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Figma MCP server running on port ${PORT}`);
    console.log(`- Health check: http://localhost:${PORT}/health`);
    console.log(`- OpenAPI spec: http://localhost:${PORT}/openapi.json`);
    console.log(`- MCP manifest: http://localhost:${PORT}/mcp.json`);
  });

  // Graceful shutdown
  function shutdown() {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server has been gracefully terminated');
      process.exit(0);
    });
    
    // Force close if it takes too long
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }

  // Handle termination signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  return server;
}