import axios from 'axios';

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaNodesResponse {
  nodes: Record<string, {
    document: FigmaNode;
    components?: Record<string, any>;
    componentSets?: Record<string, any>;
    styles?: Record<string, any>;
  }>;
  name: string;
}

// Extract file ID and node ID from a Figma URL
export function extractFigmaIds(figmaUrl: string): { fileId: string, nodeId: string | null } {
  try {
    const url = new URL(figmaUrl);
    
    // Extract the file ID from the URL path
    const pathParts = url.pathname.split('/');
    let fileIdIndex = -1;
    
    // Look for file/design/proto in the URL path
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === 'file' || pathParts[i] === 'design' || pathParts[i] === 'proto') {
        fileIdIndex = i + 1;
        break;
      }
    }
    
    if (fileIdIndex === -1 || fileIdIndex >= pathParts.length) {
      throw new Error('Invalid Figma URL format: missing file/design/proto segment');
    }
    
    const fileId = pathParts[fileIdIndex];
    
    // Extract node ID from query parameters if present
    const nodeId = url.searchParams.get('node-id') || null;
    
    return { fileId, nodeId };
  } catch (error) {
    throw new Error('Invalid Figma URL format');
  }
}

// Figma tree generator class
export class FigmaTreeGenerator {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.figma.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateNodeTree(fileId: string, nodeId: string, depth?: number): Promise<FigmaNode> {
    try {
      // Construct URL with optional depth parameter
      let url = `${this.baseUrl}/files/${fileId}/nodes?ids=${nodeId}`;
      if (depth !== undefined) {
        url += `&depth=${depth}`;
      }
      
      // Make request to Figma API
      const response = await axios.get<FigmaNodesResponse>(
        url,
        {
          headers: {
            'X-Figma-Token': this.apiKey
          }
        }
      );

      // Check if the node exists in the response
      if (!response.data.nodes[nodeId]) {
        throw new Error(`Node ${nodeId} not found in file ${fileId}`);
      }

      // Extract the document from the response
      const nodeData = response.data.nodes[nodeId].document;
      
      // Process the node tree
      return this.processNode(nodeData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch Figma node tree: ${errorMessage}`);
    }
  }

  private processNode(node: FigmaNode): FigmaNode {
    // Create a new node object to avoid mutating the original
    const processedNode: FigmaNode = {
      id: node.id,
      name: node.name,
      type: node.type
    };

    // If this is an INSTANCE node, we stop traversal here
    // By not adding children property, we indicate this is a terminal node
    if (node.type === 'INSTANCE') {
      return processedNode;
    }

    // If node has children, process them recursively
    if (node.children && node.children.length > 0) {
      processedNode.children = node.children.map(child => this.processNode(child));
    } else {
      processedNode.children = [];
    }

    return processedNode;
  }
}