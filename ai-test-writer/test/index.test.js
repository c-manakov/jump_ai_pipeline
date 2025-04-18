const path = require("path");
const fs = require("fs");
const indexModule = require("../src/index");

describe("createHeuristicSourceToTestMap", () => {
  test("should map source files to test files based on naming conventions", () => {
    const sourceFiles = [
      "lib/app/accounts.ex",
      "lib/app/accounts/user.ex",
      "lib/app_web/controllers/user_controller.ex"
    ];
    
    const testFiles = [
      "test/app/accounts_test.exs",
      "test/app/accounts/user_test.exs"
    ];
    
    const result = indexModule.createHeuristicSourceToTestMap(sourceFiles, testFiles);
    
    expect(result).toEqual({
      "lib/app/accounts.ex": "test/app/accounts_test.exs",
      "lib/app/accounts/user.ex": "test/app/accounts/user_test.exs",
      "lib/app_web/controllers/user_controller.ex": null
    });
  });
  
  test("should handle empty input arrays", () => {
    expect(indexModule.createHeuristicSourceToTestMap([], [])).toEqual({});
    expect(indexModule.createHeuristicSourceToTestMap(["lib/app/module.ex"], [])).toEqual({
      "lib/app/module.ex": null
    });
  });
  
  test("should handle project prefixes in file paths", () => {
    const sourceFiles = [
      "my_project/lib/app/module.ex"
    ];
    
    const testFiles = [
      "my_project/test/app/module_test.exs"
    ];
    
    const result = indexModule.createHeuristicSourceToTestMap(sourceFiles, testFiles);
    
    expect(result).toEqual({
      "my_project/lib/app/module.ex": "my_project/test/app/module_test.exs"
    });
  });
});

describe("generateRepoMap", () => {
  beforeEach(() => {
    jest.spyOn(fs, "readdirSync").mockImplementation((dir, options) => {
      console.log(dir);
      
      const createEntries = (names) => names.map(name => ({
        name,
        isDirectory: () => !name.endsWith(".ex"),
        isFile: () => name.endsWith(".ex")
      }));
      
      if (dir.includes("test")) {
        return createEntries(["test_helper.ex"]);
      } else if (dir.includes("app")) {
        return createEntries(["accounts_test.ex"]);
      } else if (dir.includes("lib")) {
        return createEntries([]);
      } else if (dir === path.resolve(process.cwd(), "..") || dir === "") {
        return createEntries(["lib", "test", "mix.ex"]);
      } else {
        return [];
      }
    });
    
    jest.spyOn(fs, "statSync").mockImplementation((path) => ({
      isDirectory: () => !path.endsWith(".ex"),
      isFile: () => path.endsWith(".ex")
    }));
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test("should recursively collect files from the repository", async () => {
    const result = indexModule.generateRepoMap();
    
    expect(result).toContain("test/test_helper.ex");
  });
  
  test("should handle errors gracefully", async () => {
    fs.readdirSync.mockImplementation(() => {
      throw new Error("Permission denied");
    });
    
    jest.spyOn(console, "error").mockImplementation(() => {});
    
    const result = indexModule.generateRepoMap();
    expect(result).toEqual([]);
  });
});

describe("getLastLineNumber", () => {
  test("should return 1 when patch is null or empty", () => {
    expect(indexModule.getLastLineNumber(null)).toBe(1);
    expect(indexModule.getLastLineNumber("")).toBe(1);
  });

  test("should extract the last line number from a simple patch", () => {
    const patch = `@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;`;

    expect(indexModule.getLastLineNumber(patch)).toBe(4);
  });

  test("should handle multiple hunks in a patch", () => {
    const patch = `@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;
@@ -10,3 +11,5 @@
 function test() {
   return true;
+  // Added comment
+  // Another comment
 }`;

    expect(indexModule.getLastLineNumber(patch)).toBe(15);
  });

  test("should handle patches with different line counts", () => {
    const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const e = 5;
 const c = 3;
 const d = 4;`;

    expect(indexModule.getLastLineNumber(patch)).toBe(5);
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

describe("analyzeCodeForTests", () => {
  const rewire = require("rewire");
  let rewiredModule;
  let mockAnthropic;
  
  beforeEach(() => {
    rewiredModule = rewire("../src/index");
    
    // Mock Anthropic API
    mockAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: '{"tests":[], "create_new_file": false, "test_file_path": "test/example_test.exs", "complete_test_file": "test content", "lowest_confidence": 3}' }]
        })
      }
    };
    
    // Mock fs functions
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "existing test content");
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    
    // Mock console to prevent test output pollution
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test("should call Anthropic API with correct parameters", async () => {
    const code = "def sum(a, b), do: a + b";
    const file = { filename: "lib/calculator.ex" };
    const sourceToTestMap = { "lib/calculator.ex": "test/calculator_test.exs" };
    
    await indexModule.analyzeCodeForTests(
      mockAnthropic,
      code,
      null,
      [],
      "full file content",
      sourceToTestMap,
      file
    );
    
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
    
    // Verify prompt contains necessary information
    const prompt = mockAnthropic.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("full file content");
    expect(prompt).toContain("test/calculator_test.exs");
  });
  
  test("should handle existing test files", async () => {
    const sourceToTestMap = { "lib/calculator.ex": "test/calculator_test.exs" };
    
    const result = await indexModule.analyzeCodeForTests(
      mockAnthropic,
      "code",
      null,
      [],
      "full content",
      sourceToTestMap,
      { filename: "lib/calculator.ex" }
    );
    
    expect(result).toEqual({
      tests: [],
      create_new_file: false,
      test_file_path: "test/example_test.exs",
      complete_test_file: "test content",
      lowest_confidence: 3
    });
    
    // Verify the prompt mentioned existing test file
    const prompt = mockAnthropic.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Existing test file content");
  });
  
  test("should handle non-existent test files", async () => {
    fs.existsSync.mockReturnValue(false);
    
    const sourceToTestMap = { "lib/calculator.ex": "test/calculator_test.exs" };
    
    await indexModule.analyzeCodeForTests(
      mockAnthropic,
      "code",
      null,
      [],
      "full content",
      sourceToTestMap,
      { filename: "lib/calculator.ex" }
    );
    
    // Verify the prompt mentioned no existing test file
    const prompt = mockAnthropic.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("No existing test file found");
  });
  
  test("should handle coverage data", async () => {
    const coverageData = {
      lines: [
        [1, true],
        [2, false],
        [3, true]
      ]
    };
    
    const uncoveredLines = [2];
    
    await indexModule.analyzeCodeForTests(
      mockAnthropic,
      "code",
      coverageData,
      uncoveredLines,
      "full content",
      {},
      { filename: "lib/calculator.ex" }
    );
    
    // Verify the prompt contains uncovered lines information
    const prompt = mockAnthropic.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("UNCOVERED");
  });
  
  test("should handle different response formats", async () => {
    const testCases = [
      {
        response: '{"tests":[{"target":"sum/2","explanation":"Tests basic addition","confidence":4}], "create_new_file": true, "test_file_path": "test/new_test.exs", "complete_test_file": "content", "lowest_confidence": 4}',
        expected: {
          tests: [
            {
              target: "sum/2",
              explanation: "Tests basic addition",
              confidence: 4
            }
          ],
          create_new_file: true,
          test_file_path: "test/new_test.exs",
          complete_test_file: "content",
          lowest_confidence: 4
        }
      },
      {
        response: '```json\n{"tests":[]}\n```',
        expected: { tests: [] }
      }
    ];
    
    for (const testCase of testCases) {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ text: testCase.response }]
      });
      
      const result = await indexModule.analyzeCodeForTests(
        mockAnthropic,
        "code",
        null,
        [],
        "full content",
        {},
        { filename: "lib/calculator.ex" }
      );
      
      // Only check the properties that exist in the expected result
      Object.keys(testCase.expected).forEach(key => {
        expect(result[key]).toEqual(testCase.expected[key]);
      });
    }
  });
  
  test("should handle parsing errors gracefully", async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ text: 'This is not JSON' }]
    });
    
    const result = await indexModule.analyzeCodeForTests(
      mockAnthropic,
      "code",
      null,
      [],
      "full content",
      {},
      { filename: "lib/calculator.ex" }
    );
    
    expect(result).toEqual({ suggestions: [] });
  });
});
