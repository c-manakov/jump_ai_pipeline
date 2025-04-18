const path = require("path");
const fs = require("fs");
const indexModule = require("../src/index");
const rewire = require("rewire");

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

describe("run", () => {
  // Use rewire to access and modify private functions
  let rewiredModule;
  let mockOctokit;
  let mockAnthropic;
  let mockCore;
  let mockGithub;
  
  beforeEach(() => {
    // Create a new rewired instance for each test
    rewiredModule = rewire("../src/index");
    
    // Mock dependencies
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({ data: [] }),
          get: jest.fn().mockResolvedValue({ data: { head: { ref: "test-branch", sha: "test-sha" } } }),
          createReviewComment: jest.fn().mockResolvedValue({})
        },
        git: {
          getRef: jest.fn().mockResolvedValue({ data: { object: { sha: "test-sha" } } }),
          getCommit: jest.fn().mockResolvedValue({ data: { tree: { sha: "test-tree-sha" } } }),
          createBlob: jest.fn().mockResolvedValue({ data: { sha: "test-blob-sha" } }),
          createTree: jest.fn().mockResolvedValue({ data: { sha: "test-new-tree-sha" } }),
          createCommit: jest.fn().mockResolvedValue({ data: { sha: "test-new-commit-sha" } }),
          updateRef: jest.fn().mockResolvedValue({})
        },
        actions: {
          createWorkflowDispatch: jest.fn().mockResolvedValue({})
        }
      }
    };
    
    mockAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: '{"tests":[], "create_new_file": false, "test_file_path": "test/example_test.exs", "complete_test_file": "test content", "lowest_confidence": 3}' }]
        })
      }
    };
    
    mockCore = {
      getInput: jest.fn((name, options) => {
        if (name === "github-token") return "mock-token";
        if (name === "anthropic-api-key") return "mock-api-key";
        if (name === "coverage-path") return "cover/coverage.json";
        if (name === "pr-number") return "123";
        return "";
      }),
      setFailed: jest.fn()
    };
    
    mockGithub = {
      getOctokit: jest.fn().mockReturnValue(mockOctokit),
      context: {
        repo: { owner: "test-owner", repo: "test-repo" },
        payload: { pull_request: { number: 123 } }
      }
    };
    
    // Replace the internal dependencies with our mocks
    rewiredModule.__set__("core", mockCore);
    rewiredModule.__set__("github", mockGithub);
    rewiredModule.__set__("Anthropic", function() {
      return mockAnthropic;
    });
    
    // Mock other functions
    rewiredModule.__set__("generateRepoMap", jest.fn().mockReturnValue(["lib/app/accounts.ex"]));
    rewiredModule.__set__("mapSourceFilesToTestFiles", jest.fn().mockResolvedValue({
      "lib/app/accounts.ex": "test/app/accounts_test.exs"
    }));
    rewiredModule.__set__("extractAddedLines", jest.fn().mockReturnValue(["def sum(a, b), do: a + b"]));
    rewiredModule.__set__("analyzeCodeForTests", jest.fn().mockResolvedValue({ 
      tests: [],
      create_new_file: false,
      test_file_path: "test/app/accounts_test.exs",
      complete_test_file: "test content",
      lowest_confidence: 3
    }));
    rewiredModule.__set__("postTestSuggestions", jest.fn().mockResolvedValue(undefined));
    rewiredModule.__set__("implementPendingTestFiles", jest.fn().mockResolvedValue(undefined));
    
    // Mock fs functions
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "mock file content");
    jest.spyOn(fs, "existsSync").mockImplementation(() => true);
    jest.spyOn(fs, "readdirSync").mockImplementation(() => ["lib", "test"]);
    
    // Mock console methods to prevent test output pollution
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test("should process PR files and analyze code for tests", async () => {
    // Setup mock PR files
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/accounts.ex", 
          status: "modified",
          patch: "@@ -1,3 +1,4 @@\n def old_func, do: nil\n+def sum(a, b), do: a + b\n def other_func, do: nil"
        }
      ]
    });
    
    // Get the run function from the rewired module
    const run = rewiredModule.__get__("run");
    
    // Call the function
    await run();
    
    // Verify the correct functions were called
    expect(mockGithub.getOctokit).toHaveBeenCalledWith("mock-token");
    expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      pull_number: "123"
    });
    
    const generateRepoMap = rewiredModule.__get__("generateRepoMap");
    expect(generateRepoMap).toHaveBeenCalled();
    
    const mapSourceFilesToTestFiles = rewiredModule.__get__("mapSourceFilesToTestFiles");
    expect(mapSourceFilesToTestFiles).toHaveBeenCalledWith(
      mockAnthropic,
      expect.any(Array)
    );
    
    const extractAddedLines = rewiredModule.__get__("extractAddedLines");
    expect(extractAddedLines).toHaveBeenCalledWith(expect.any(String));
    
    const analyzeCodeForTests = rewiredModule.__get__("analyzeCodeForTests");
    expect(analyzeCodeForTests).toHaveBeenCalledWith(
      mockAnthropic,
      expect.any(String),
      undefined,
      [],
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ filename: "lib/app/accounts.ex" })
    );
  });
  
  test("should skip removed files", async () => {
    // Setup mock PR files with a removed file
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/removed.ex", 
          status: "removed",
          patch: "@@ -1,3 +0,0 @@\n-def func1, do: nil\n-def func2, do: nil\n-def func3, do: nil"
        }
      ]
    });
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify analyzeCodeForTests was not called
    const analyzeCodeForTests = rewiredModule.__get__("analyzeCodeForTests");
    expect(analyzeCodeForTests).not.toHaveBeenCalled();
  });
  
  test("should skip non-Elixir files", async () => {
    // Setup mock PR files with a non-Elixir file
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/script.js", 
          status: "modified",
          patch: "@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;"
        }
      ]
    });
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify analyzeCodeForTests was not called
    const analyzeCodeForTests = rewiredModule.__get__("analyzeCodeForTests");
    expect(analyzeCodeForTests).not.toHaveBeenCalled();
  });
  
  test("should skip files with no added lines", async () => {
    // Setup mock PR files with no added lines
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/unchanged.ex", 
          status: "modified",
          patch: "@@ -1,3 +1,3 @@\n def func1, do: nil\n def func2, do: nil\n def func3, do: nil"
        }
      ]
    });
    
    // Mock extractAddedLines to return empty array
    rewiredModule.__get__("extractAddedLines").mockReturnValue([]);
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify analyzeCodeForTests was not called
    const analyzeCodeForTests = rewiredModule.__get__("analyzeCodeForTests");
    expect(analyzeCodeForTests).not.toHaveBeenCalled();
  });
  
  test("should post test suggestions when tests are found", async () => {
    // Setup mock PR files
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/accounts.ex", 
          status: "modified",
          patch: "@@ -1,3 +1,4 @@\n def old_func, do: nil\n+def sum(a, b), do: a + b\n def other_func, do: nil"
        }
      ]
    });
    
    // Mock analyzeCodeForTests to return tests
    rewiredModule.__get__("analyzeCodeForTests").mockResolvedValue({
      tests: [
        {
          target: "sum/2",
          explanation: "Tests basic addition",
          confidence: 4
        }
      ],
      create_new_file: false,
      test_file_path: "test/app/accounts_test.exs",
      complete_test_file: "test content",
      lowest_confidence: 4
    });
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify postTestSuggestions was called
    const postTestSuggestions = rewiredModule.__get__("postTestSuggestions");
    expect(postTestSuggestions).toHaveBeenCalledWith(
      mockOctokit,
      "test-owner",
      "test-repo",
      "123",
      expect.objectContaining({ filename: "lib/app/accounts.ex" }),
      expect.objectContaining({ 
        tests: expect.arrayContaining([
          expect.objectContaining({ target: "sum/2" })
        ]) 
      })
    );
  });
  
  test("should implement pending test files when tests have high confidence", async () => {
    // Setup mock PR files
    mockOctokit.rest.pulls.listFiles.mockResolvedValue({
      data: [
        { 
          filename: "lib/app/accounts.ex", 
          status: "modified",
          patch: "@@ -1,3 +1,4 @@\n def old_func, do: nil\n+def sum(a, b), do: a + b\n def other_func, do: nil"
        }
      ]
    });
    
    // Mock analyzeCodeForTests to return high confidence tests
    rewiredModule.__get__("analyzeCodeForTests").mockResolvedValue({
      tests: [
        {
          target: "sum/2",
          explanation: "Tests basic addition",
          confidence: 5
        }
      ],
      create_new_file: true,
      test_file_path: "test/app/accounts_test.exs",
      complete_test_file: "test content",
      lowest_confidence: 5
    });
    
    // Mock the pendingTestFiles array
    rewiredModule.__set__("pendingTestFiles", [
      {
        testFilePath: "test/app/accounts_test.exs",
        testFileContent: "test content",
        sourceFilePath: "lib/app/accounts.ex"
      }
    ]);
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify implementPendingTestFiles was called
    const implementPendingTestFiles = rewiredModule.__get__("implementPendingTestFiles");
    expect(implementPendingTestFiles).toHaveBeenCalledWith(
      mockOctokit,
      "test-owner",
      "test-repo",
      "123"
    );
  });
  
  test("should handle errors gracefully", async () => {
    // Force an error by making listFiles throw
    mockOctokit.rest.pulls.listFiles.mockRejectedValue(new Error("Test error"));
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify setFailed was called
    expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining("Test error"));
  });
  
  test("should handle missing required inputs", async () => {
    // Mock getInput to return empty values
    mockCore.getInput.mockImplementation(() => "");
    
    const run = rewiredModule.__get__("run");
    await run();
    
    // Verify setFailed was called with appropriate error message
    expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining("GitHub token is required"));
  });
});
