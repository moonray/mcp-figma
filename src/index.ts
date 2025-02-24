#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { extractFigmaIds, FigmaTreeGenerator } from './figma-api.js';
import { startExpressServer } from './express-server.js';

// Load environment variables
dotenv.config();

// Determine if running in CLI (MCP) mode
const isCliMode = !process.stdin.isTTY || process.argv.includes('--cli');

// For non-CLI mode, start the Express server
if (!isCliMode) {
  startExpressServer();
} else {
  // CLI mode - use MCP SDK
  runMcpServer();
}

async function runMcpServer() {
  console.error('Starting Figma MCP Server in CLI mode');
  
  const server = new Server(
    {
      name: 'figma-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        logging: {},
      },
    }
  );

  // Define tools
  const ANALYZE_FIGMA_FILE: Tool = {
    name: 'analyze_figma_file',
    description: 'Analyze a Figma file structure to understand its nodes and hierarchy',
    inputSchema: {
      type: 'object',
      properties: {
        figmaUrl: {
          type: 'string',
          description: 'The URL of the Figma file to analyze',
        },
        depth: {
          type: 'number',
          description: 'Optional depth parameter to limit the node tree depth',
        },
      },
      required: ['figmaUrl'],
    },
  };

  // Register tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [ANALYZE_FIGMA_FILE],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'analyze_figma_file') {
      const input = request.params.arguments as { figmaUrl: string; depth?: number };
      return doAnalyzeFigmaFile(input.figmaUrl, input.depth);
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  });

  // Set up error handler
  server.onerror = (error) => {
    console.error('MCP Server error:', error);
  };

  // Handle process termination
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  // Connect server to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Figma MCP Server running on stdio');
}

async function doAnalyzeFigmaFile(figmaUrl: string, depth?: number): Promise<CallToolResult> {
  try {
    // Get Figma API Key
    const figmaApiKey = process.env.FIGMA_API_KEY;
    if (!figmaApiKey) {
      throw new Error('FIGMA_API_KEY not configured');
    }
    
    // Extract file ID and node ID from URL
    const { fileId, nodeId } = extractFigmaIds(figmaUrl);
    
    if (!fileId) {
      throw new Error('Could not extract file ID from URL');
    }
    
    if (!nodeId) {
      throw new Error('No node ID specified in URL');
    }
    
    // Generate the node tree
    const treeGenerator = new FigmaTreeGenerator(figmaApiKey);
    const tree = await treeGenerator.generateNodeTree(fileId, nodeId, depth);
    
    // Return the result
    return {
      content: [
        {
          type: 'text',
          text: `Successfully analyzed Figma file: ${figmaUrl}`,
        },
        {
          type: 'text',
          text: `File ID: ${fileId}`,
        },
        {
          type: 'text',
          text: `Node ID: ${nodeId}`,
        },
        {
          type: 'text',
          text: 'Node Tree Structure:',
        },
        {
          type: 'text',
          text: JSON.stringify(tree, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('Error analyzing Figma file:', error);
    
    // Return error as text content instead of throwing
    return {
      content: [
        {
          type: 'text',
          text: `Error analyzing Figma file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
}