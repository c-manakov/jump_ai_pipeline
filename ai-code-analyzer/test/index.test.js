const path = require("path");
const fs = require("fs");
const glob = require("glob");
const rewire = require("rewire");

const indexModule = require("../src/index");
const {
  findCodeInPatch,
  shouldIgnoreFile,
  loadIgnorePatterns,
  formatSuggestionIndentation,
} = indexModule;

jest.mock("glob");

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
    expect(shouldIgnoreFile("node_modules/package/index.js", patterns)).toBe(
      true,
    );
  });
});

describe("loadIgnorePatterns", () => {
  beforeEach(() => {
    jest.spyOn(fs, "existsSync").mockImplementation(() => false);
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "");
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
    fs.readFileSync.mockReturnValue(
      "*.js\n# This is a comment\n\n  test/*  \n#Another comment",
    );

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
  let rewiredModule;
  let mockFindCodeInPatch;
  let mockFormatSuggestionIndentation;

  beforeEach(() => {
    rewiredModule = rewire("../src/index");

    jest.spyOn(console, "error").mockImplementation(() => {});

    mockFindCodeInPatch = jest.fn();
    mockFormatSuggestionIndentation = jest.fn();

    rewiredModule.__set__("findCodeInPatch", mockFindCodeInPatch);
    rewiredModule.__set__(
      "formatSuggestionIndentation",
      mockFormatSuggestionIndentation,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should post comments for issues with valid line numbers", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } },
          }),
          createReviewComment: jest.fn().mockResolvedValue({}),
        },
      },
    };

    const mockFile = {
      filename: "test.js",
      patch:
        "@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;\n const d = 4;",
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "const b = 2;",
          explanation: "Test explanation",
          suggestion: "const b = 2; // Fixed",
        },
      ],
    };

    mockFindCodeInPatch.mockReturnValue({
      startLine: 2,
      endLine: 2,
      originalIndentation: null,
    });

    mockFormatSuggestionIndentation.mockReturnValue("const b = 2; // Fixed");

    const postComments = rewiredModule.__get__("postComments");

    await postComments(
      mockOctokit,
      "owner",
      "repo",
      123,
      mockFile,
      mockAnalysis,
    );

    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
    });

    expect(mockFindCodeInPatch).toHaveBeenCalledWith(
      mockFile.patch,
      "const b = 2;",
    );
    expect(mockFormatSuggestionIndentation).toHaveBeenCalledWith(
      "const b = 2; // Fixed",
      null,
    );

    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      body: expect.stringContaining("Code Review: test-rule"),
      commit_id: "test-commit-sha",
      path: "test.js",
      line: 2,
    });
  });

  test("should skip issues with invalid line numbers", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } },
          }),
          createReviewComment: jest.fn().mockResolvedValue({}),
        },
      },
    };

    const mockFile = {
      filename: "test.js",
      patch:
        "@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;\n const d = 4;",
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "non-existent code",
          explanation: "Test explanation",
          suggestion: "const b = 2; // Fixed",
        },
      ],
    };

    mockFindCodeInPatch.mockReturnValue({
      startLine: null,
      endLine: null,
      originalIndentation: null,
    });

    const postComments = rewiredModule.__get__("postComments");
    
    await postComments(
      mockOctokit,
      "owner",
      "repo",
      123,
      mockFile,
      mockAnalysis,
    );

    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
    });

    expect(mockFindCodeInPatch).toHaveBeenCalledWith(
      mockFile.patch,
      "non-existent code",
    );
    expect(mockOctokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
  });

  test("should handle multi-line comments", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { head: { sha: "test-commit-sha" } },
          }),
          createReviewComment: jest.fn().mockResolvedValue({}),
        },
      },
    };

    const mockFile = {
      filename: "test.js",
      patch:
        "@@ -1,3 +1,5 @@\n const a = 1;\n+const b = 2;\n+const e = 5;\n const c = 3;\n const d = 4;",
    };

    const mockAnalysis = {
      issues: [
        {
          rule_id: "test-rule",
          code: "const b = 2;\nconst e = 5;",
          explanation: "Test explanation",
          suggestion: "const b = 2;\nconst e = 5; // Fixed",
        },
      ],
    };

    mockFindCodeInPatch.mockReturnValue({
      startLine: 2,
      endLine: 3,
      originalIndentation: null,
    });

    mockFormatSuggestionIndentation.mockReturnValue(
      "const b = 2;\nconst e = 5; // Fixed",
    );
    
    const postComments = rewiredModule.__get__("postComments");

    await postComments(
      mockOctokit,
      "owner",
      "repo",
      123,
      mockFile,
      mockAnalysis,
    );

    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      body: expect.stringContaining("Code Review: test-rule"),
      commit_id: "test-commit-sha",
      path: "test.js",
      start_line: 2,
      line: 3,
    });
  });
});

describe("analyzeCode", () => {
  let rewiredModule;
  let mockAnthropic;
  
  beforeEach(() => {
    rewiredModule = rewire("../src/index");
    
    mockAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: '{"issues":[]}' }]
        })
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call Anthropic API with correct parameters", async () => {
    const analyzeCode = rewiredModule.__get__("analyzeCode");
    
    const code = "const x = 1;";
    const rules = [
      { id: "rule1", title: "Rule 1", content: "Don't do X" },
      { id: "rule2", title: "Rule 2", content: "Always do Y" }
    ];
    const fullFileContent = "const a = 0;\nconst x = 1;\nconst y = 2;";
    
    await analyzeCode(mockAnthropic, code, rules, fullFileContent);
    
    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        max_tokens: expect.any(Number),
        system: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(code)
          })
        ])
      })
    );
    
    const prompt = mockAnthropic.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Rule 1");
    expect(prompt).toContain("Rule 2");
    expect(prompt).toContain("Don't do X");
    expect(prompt).toContain("Always do Y");
    expect(prompt).toContain(fullFileContent);
  });

  test("should parse response correctly when issues are found", async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ 
        text: '```json\n{"issues":[{"rule_id":"rule1","code":"const x = 1;","explanation":"X is not allowed","suggestion":"const y = 1;"}]}\n```' 
      }]
    });
    
    const analyzeCode = rewiredModule.__get__("analyzeCode");
    
    const result = await analyzeCode(
      mockAnthropic, 
      "const x = 1;", 
      [{ id: "rule1", title: "Rule 1", content: "Don't do X" }]
    );
    
    expect(result).toEqual({
      issues: [
        {
          rule_id: "rule1",
          code: "const x = 1;",
          explanation: "X is not allowed",
          suggestion: "const y = 1;"
        }
      ]
    });
  });

  test("should handle different JSON response formats", async () => {
    const testCases = [
      { 
        response: '{"issues":[{"rule_id":"rule1","code":"const x = 1;","explanation":"X is not allowed","suggestion":"const y = 1;"}]}',
        expected: {
          issues: [
            {
              rule_id: "rule1",
              code: "const x = 1;",
              explanation: "X is not allowed",
              suggestion: "const y = 1;"
            }
          ]
        }
      },
      {
        response: '```\n{"issues":[]}\n```',
        expected: { issues: [] }
      },
      {
        response: '```json\n{"issues":[]}\n```',
        expected: { issues: [] }
      }
    ];
    
    const analyzeCode = rewiredModule.__get__("analyzeCode");
    
    for (const testCase of testCases) {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ text: testCase.response }]
      });
      
      const result = await analyzeCode(
        mockAnthropic, 
        "const x = 1;", 
        [{ id: "rule1", title: "Rule 1", content: "Don't do X" }]
      );
      
      expect(result).toEqual(testCase.expected);
    }
  });

  test("should handle parsing errors gracefully", async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ text: 'This is not JSON' }]
    });
    
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const analyzeCode = rewiredModule.__get__("analyzeCode");
    
    const result = await analyzeCode(
      mockAnthropic, 
      "const x = 1;", 
      [{ id: "rule1", title: "Rule 1", content: "Don't do X" }]
    );
    
    expect(result).toEqual({ issues: [] });
  });
});

describe("loadRules", () => {
  beforeEach(() => {
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "# Rule Title\n\nRule content goes here");
    jest.spyOn(fs, "existsSync").mockImplementation(() => true);
    
    jest.spyOn(glob, "sync").mockReturnValue([
      ".ai-code-rules/rule1.md",
      ".ai-code-rules/rule2.md"
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should load rules from markdown files", async () => {
    const rules = await indexModule.loadRules(".ai-code-rules");
    
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual(expect.objectContaining({
      id: "rule1",
      title: "Rule Title",
      content: "# Rule Title\n\nRule content goes here",
      path: expect.stringContaining("rule1.md")
    }));
    expect(rules[1]).toEqual(expect.objectContaining({
      id: "rule2",
      title: "Rule Title",
      content: "# Rule Title\n\nRule content goes here",
      path: expect.stringContaining("rule2.md")
    }));
  });

  test("should handle rules without proper title", async () => {
    fs.readFileSync.mockImplementation(() => "Rule content without title");
    
    const rules = await indexModule.loadRules(".ai-code-rules");
    
    expect(rules).toHaveLength(2);
    expect(rules[0].title).toBe("rule1");
    expect(rules[1].title).toBe("rule2");
  });

  test("should return empty array when no rules found", async () => {
    glob.sync.mockImplementation(() => []);
    
    const rules = await indexModule.loadRules(".ai-code-rules");
    
    expect(rules).toEqual([]);
  });

  test("should handle errors when reading rule files", async () => {
    fs.readFileSync
      .mockImplementationOnce(() => { throw new Error("File not found"); })
      .mockImplementationOnce(() => "# Rule 2\n\nContent for rule 2");
    
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const rules = await indexModule.loadRules(".ai-code-rules");
    
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("rule2");
  });
});

describe("extractAddedLines", () => {
  test("should return empty array when patch is null or undefined", () => {
    expect(indexModule.extractAddedLines(null)).toEqual([]);
    expect(indexModule.extractAddedLines(undefined)).toEqual([]);
  });

  test("should extract only added lines from patch", () => {
    const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
 const c = 3;
+const d = 4;
 const e = 5;`;

    const result = indexModule.extractAddedLines(patch);
    expect(result).toEqual([
      "const b = 2;",
      "const d = 4;"
    ]);
  });

  test("should ignore lines starting with +++ (header lines)", () => {
    const patch = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;`;

    const result = indexModule.extractAddedLines(patch);
    expect(result).toEqual([
      "const b = 2;"
    ]);
  });

  test("should handle empty patches", () => {
    expect(indexModule.extractAddedLines("")).toEqual([]);
  });

  test("should handle patches with no added lines", () => {
    const patch = `@@ -1,3 +1,3 @@
 const a = 1;
 const b = 2;
 const c = 3;`;

    expect(indexModule.extractAddedLines(patch)).toEqual([]);
  });
});

// let's add a test suite for run function now AI!
