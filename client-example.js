#!/usr/bin/env node

// This is a simple example of how to use the Figma MCP server from a Node.js client
// Run with: node client-example.js <figma-url> [<depth>]

import axios from 'axios';

async function analyzeFigma(figmaUrl, depth) {
  try {
    const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000';
    
    console.log(`Analyzing Figma URL: ${figmaUrl}`);
    
    const requestData = {
      figmaUrl,
      ...(depth !== undefined && { depth: parseInt(depth, 10) })
    };
    
    const response = await axios.post(`${serverUrl}/analyze`, requestData);
    
    console.log('Analysis complete!');
    console.log('File ID:', response.data.fileId);
    console.log('Node ID:', response.data.nodeId);
    console.log('Node Tree:');
    console.log(JSON.stringify(response.data.tree, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing Figma file:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

// Get command line arguments
const figmaUrl = process.argv[2];
const depth = process.argv[3];

if (!figmaUrl) {
  console.error('Usage: node client-example.js <figma-url> [<depth>]');
  process.exit(1);
}

analyzeFigma(figmaUrl, depth);
