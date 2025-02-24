import { extractFigmaIds } from '../figma-api.js';

// Skip the FigmaTreeGenerator tests for now since they require axios mocking
describe('Figma API Module', () => {
  describe('extractFigmaIds', () => {
    test('should extract file ID and node ID from a design URL', () => {
      const url = 'https://www.figma.com/design/ABC123/ProjectName?node-id=456-789';
      const result = extractFigmaIds(url);
      expect(result.fileId).toBe('ABC123');
      expect(result.nodeId).toBe('456-789');
    });

    test('should extract file ID and node ID from a file URL', () => {
      const url = 'https://www.figma.com/file/DEF456/AnotherProject?node-id=123-456';
      const result = extractFigmaIds(url);
      expect(result.fileId).toBe('DEF456');
      expect(result.nodeId).toBe('123-456');
    });

    test('should extract file ID and return null for node ID if not present', () => {
      const url = 'https://www.figma.com/file/GHI789/Project';
      const result = extractFigmaIds(url);
      expect(result.fileId).toBe('GHI789');
      expect(result.nodeId).toBeNull();
    });

    test('should throw error for invalid URL', () => {
      const url = 'https://example.com/not-figma';
      expect(() => extractFigmaIds(url)).toThrow('Invalid Figma URL format');
    });
  });
});