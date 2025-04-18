// Mock Node.js constants
const originalConstants = { ...process.binding('constants').fs };
process.binding = function(name) {
  return name === 'constants' ? { fs: originalConstants } : {};
};

// Mock modules before requiring them
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  promises: {
    access: jest.fn()
  },
  constants: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_CREAT: 64,
    O_EXCL: 128,
    O_TRUNC: 512,
    O_APPEND: 1024,
    O_DIRECTORY: 65536
  }
}));

// Mock other modules
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(),
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    },
    payload: {
      pull_request: {
        number: 123
      }
    }
  }
}));

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: '{"issues":[]}' }]
      })
    }
  }))
}));

jest.mock('glob', () => ({
  sync: jest.fn().mockReturnValue([])
}));

// Now import the modules
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const github = require('@actions/github');
const core = require('@actions/core');

// Import the functions we want to test
// We need to use rewire to access private functions
const rewire = require('rewire');
const indexModule = rewire('../src/index.js');

// Access private functions
const findCodeInPatch = indexModule.__get__('findCodeInPatch');
const extractAddedLines = indexModule.__get__('extractAddedLines');
const shouldIgnoreFile = indexModule.__get__('shouldIgnoreFile');
const loadIgnorePatterns = indexModule.__get__('loadIgnorePatterns');

describe('AI Code Analyzer', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('findCodeInPatch', () => {
    test('should return null values when patch or code snippet is empty', () => {
      const result = findCodeInPatch(null, 'code');
      expect(result.startLine).toBeNull();
      expect(result.endLine).toBeNull();
      expect(result.originalIndentation).toBeNull();
      
      const result2 = findCodeInPatch('patch', null);
      expect(result2.startLine).toBeNull();
      expect(result2.endLine).toBeNull();
      expect(result2.originalIndentation).toBeNull();
    });
    
    test('should find line numbers for a single line code snippet', () => {
      const patch = `@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;`;
      
      const result = findCodeInPatch(patch, 'const b = 2;');
      expect(result.startLine).toBe(2);
      expect(result.endLine).toBe(2);
    });
    
    test('should find line numbers for a multi-line code snippet', () => {
      const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const e = 5;
 const c = 3;
 const d = 4;`;
      
      const result = findCodeInPatch(patch, 'const b = 2;\nconst e = 5;');
      expect(result.startLine).toBe(2);
      expect(result.endLine).toBe(3);
    });
    
    test('should extract indentation from code snippet', () => {
      const patch = `@@ -1,3 +1,4 @@
 function test() {
+  const indented = true;
 }
 const d = 4;`;
      
      const result = findCodeInPatch(patch, '  const indented = true;');
      expect(result.originalIndentation).toBe('  ');
    });
  });
  
  describe('extractAddedLines', () => {
    test('should return empty array for null patch', () => {
      const result = extractAddedLines(null);
      expect(result).toEqual([]);
    });
    
    test('should extract added lines from patch', () => {
      const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const e = 5;
 const c = 3;
 const d = 4;`;
      
      const result = extractAddedLines(patch);
      expect(result).toEqual(['const b = 2;', 'const e = 5;']);
    });
    
    test('should ignore lines starting with +++', () => {
      const patch = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;`;
      
      const result = extractAddedLines(patch);
      expect(result).toEqual(['const b = 2;']);
    });
  });
  
  describe('shouldIgnoreFile', () => {
    test('should return false when patterns array is empty', () => {
      const result = shouldIgnoreFile('file.js', []);
      expect(result).toBe(false);
    });
    
    test('should return true when filename matches a pattern', () => {
      const patterns = ['*.js', 'test/*'];
      expect(shouldIgnoreFile('file.js', patterns)).toBe(true);
      expect(shouldIgnoreFile('test/file.txt', patterns)).toBe(true);
    });
    
    test('should return false when filename does not match any pattern', () => {
      const patterns = ['*.js', 'test/*'];
      expect(shouldIgnoreFile('file.txt', patterns)).toBe(false);
      expect(shouldIgnoreFile('src/file.txt', patterns)).toBe(false);
    });
  });
  
  describe('loadIgnorePatterns', () => {
    test('should return empty array when ignore file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const result = loadIgnorePatterns();
      expect(result).toEqual([]);
    });
    
    test('should load patterns from ignore file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('*.js\n# Comment\n\ntest/*');
      
      const result = loadIgnorePatterns();
      expect(result).toEqual(['*.js', 'test/*']);
    });
  });
});
