const path = require("path");
const fs = require("fs");

// Import the module - we'll mock specific functions in the tests
const indexModule = require("../src/index");
const { findCodeInPatch, shouldIgnoreFile, loadIgnorePatterns, formatSuggestionIndentation, postComments } = indexModule;

// Mock the entire module for the postComments tests
jest.mock("../src/index", () => {
  const originalModule = jest.requireActual("../src/index");
  return {
    ...originalModule,
    findCodeInPatch: jest.fn(),
    formatSuggestionIndentation: jest.fn()
  };
});

describe("findCodeInPatch", () => {
  test("should return null values when patch or code snippet is empty", () => {
    const result = findCodeInPatch(null, "code");
    expect(result.startLine).toBeNull();
    expect(result.endLine).toBeNull();
    expect(result.originalIndentation).toBeNull();

    const result2 = findCodeInPatch("patch", null);
    expect(result2.startLine).toBeNull();
    expect(result2.endLine).toBeNull();
    expect(result2.originalIndentation).toBeNull();
  });

  test("should find line numbers for a single line code snippet", () => {
    const patch = `@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;`;

    const result = findCodeInPatch(patch, "const b = 2;");
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(2);
  });

  test("should find line numbers for a multi-line code snippet", () => {
    const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const e = 5;
 const c = 3;
 const d = 4;`;

    const result = findCodeInPatch(patch, "const b = 2;\nconst e = 5;");
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(3);
  });

  test("should extract indentation from code snippet", () => {
    const patch = `@@ -1,3 +1,4 @@
 function test() {
+  const indented = true;
 }
 const d = 4;`;

    const result = findCodeInPatch(patch, "  const indented = true;");
    expect(result.originalIndentation).toBe("  ");
  });
});

describe("shouldIgnoreFile", () => {
  test("should return false when patterns array is empty", () => {
    const result = shouldIgnoreFile("file.js", []);
    expect(result).toBe(false);
  });
  
  test("should return true when filename matches a pattern", () => {
    const patterns = ["*.js", "test/*"];
    expect(shouldIgnoreFile("file.js", patterns)).toBe(true);
    expect(shouldIgnoreFile("test/file.txt", patterns)).toBe(true);
  });
  
  test("should return false when filename does not match any pattern", () => {
    const patterns = ["*.js", "test/*"];
    expect(shouldIgnoreFile("file.txt", patterns)).toBe(false);
    expect(shouldIgnoreFile("src/file.txt", patterns)).toBe(false);
  });
  
  test("should match directories in path", () => {
    const patterns = ["node_modules/*"];
    expect(shouldIgnoreFile("node_modules/package/index.js", patterns)).toBe(true);
  });
});

describe("loadIgnorePatterns", () => {
  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return empty array when ignore file does not exist", () => {
    fs.existsSync.mockReturnValue(false);
    
    const result = loadIgnorePatterns();
    expect(result).toEqual([]);
  });

  test("should load patterns from ignore file", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("*.js\n# Comment\n\ntest/*");
    
    const result = loadIgnorePatterns();
    expect(result).toEqual(["*.js", "test/*"]);
  });

  test("should handle empty lines and comments", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("*.js\n# This is a comment\n\n  test/*  \n#Another comment");
    
    const result = loadIgnorePatterns();
    expect(result).toEqual(["*.js", "test/*"]);
  });
});

describe("formatSuggestionIndentation", () => {
  test("should return original suggestion when no indentation is provided", () => {
    const suggestion = "const x = 1;\nconst y = 2;";
    const result = formatSuggestionIndentation(suggestion, null);
    expect(result).toBe(suggestion);
  });

  test("should return original suggestion when suggestion is null or empty", () => {
    expect(formatSuggestionIndentation(null, "  ")).toBeNull();
    expect(formatSuggestionIndentation("", "  ")).toBe("");
  });

  test("should apply indentation to all non-empty lines", () => {
    const suggestion = "if (condition) {\n  doSomething();\n}";
    const indentation = "  ";
    const expected = "  if (condition) {\n  doSomething();\n  }";
    const result = formatSuggestionIndentation(suggestion, indentation);
    expect(result).toBe(expected);
  });

  test("should preserve empty lines without indentation", () => {
    const suggestion = "line1\n\nline2";
    const indentation = "  ";
    const expected = "  line1\n\n  line2";
    const result = formatSuggestionIndentation(suggestion, indentation);
    expect(result).toBe(expected);
  });

  test("should remove existing indentation before applying new indentation", () => {
    const suggestion = "  line1\n    line2";
    const indentation = "    ";
    const expected = "    line1\n    line2";
    const result = formatSuggestionIndentation(suggestion, indentation);
    expect(result).toBe(expected);
  });
});

describe("postComments", () => {
  // Mock the functions we need to test
  const originalFindCodeInPatch = jest.fn();
  const originalFormatSuggestionIndentation = jest.fn();
  
  beforeEach(() => {
    // Mock console.error but allow console.log for debugging
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock the functions we need
    jest.mock(indexModule, findCodeInPatch, )
    jest.mock('../src/index', () => {
      const originalModule = jest.requireActual('../src/index');
      return {
        ...originalModule,
        findCodeInPatch: originalFindCodeInPatch,
        formatSuggestionIndentation: originalFormatSuggestionIndentation
      };
    }, { virtual: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  test("should post comments for issues with valid line numbers", async () => {
    // Mock dependencies
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } }
          }),
          createReviewComment: jest.fn().mockResolvedValue({})
        }
      }
    };

    const mockFile = {
      filename: "test.js",
      patch: "@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;\n const d = 4;"
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "const b = 2;",
          explanation: "Test explanation",
          suggestion: "const b = 2; // Fixed"
        }
      ]
    };

    // Setup mock return values
    originalFindCodeInPatch.mockReturnValue({ 
      startLine: 2, 
      endLine: 2, 
      originalIndentation: null 
    });
    
    originalFormatSuggestionIndentation.mockReturnValue("const b = 2; // Fixed");

    // Call the function
    await postComments(mockOctokit, "owner", "repo", 123, mockFile, mockAnalysis);

    // Verify the function was called with the right arguments
    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123
    });

    expect(originalFindCodeInPatch).toHaveBeenCalledWith(mockFile.patch, "const b = 2;");
    expect(originalFormatSuggestionIndentation).toHaveBeenCalledWith("const b = 2; // Fixed", null);

    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      body: expect.stringContaining("AI Code Review: test-rule"),
      commit_id: "test-commit-sha",
      path: "test.js",
      line: 2
    });
  });

  test("should skip issues with invalid line numbers", async () => {
    // Mock dependencies
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } }
          }),
          createReviewComment: jest.fn().mockResolvedValue({})
        }
      }
    };

    const mockFile = {
      filename: "test.js",
      patch: "@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;\n const d = 4;"
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "non-existent code",
          explanation: "Test explanation",
          suggestion: "const b = 2; // Fixed"
        }
      ]
    };

    // Setup mock return values
    originalFindCodeInPatch.mockReturnValue({ 
      startLine: null, 
      endLine: null, 
      originalIndentation: null 
    });

    // Call the function
    await postComments(mockOctokit, "owner", "repo", 123, mockFile, mockAnalysis);

    // Verify the function was called with the right arguments
    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123
    });

    expect(originalFindCodeInPatch).toHaveBeenCalledWith(mockFile.patch, "non-existent code");
    expect(mockOctokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
  });

  test("should handle multi-line comments", async () => {
    // Mock dependencies
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } }
          }),
          createReviewComment: jest.fn().mockResolvedValue({})
        }
      }
    };

    const mockFile = {
      filename: "test.js",
      patch: "@@ -1,3 +1,5 @@\n const a = 1;\n+const b = 2;\n+const e = 5;\n const c = 3;\n const d = 4;"
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "const b = 2;\nconst e = 5;",
          explanation: "Test explanation",
          suggestion: "const b = 2;\nconst e = 5; // Fixed"
        }
      ]
    };

    // Setup mock return values
    originalFindCodeInPatch.mockReturnValue({ 
      startLine: 2, 
      endLine: 3, 
      originalIndentation: null 
    });
    
    originalFormatSuggestionIndentation.mockReturnValue("const b = 2;\nconst e = 5; // Fixed");

    // Call the function
    await postComments(mockOctokit, "owner", "repo", 123, mockFile, mockAnalysis);

    // Verify the function was called with the right arguments
    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      body: expect.stringContaining("AI Code Review: test-rule"),
      commit_id: "test-commit-sha",
      path: "test.js",
      start_line: 2,
      line: 3
    });
  });
});
