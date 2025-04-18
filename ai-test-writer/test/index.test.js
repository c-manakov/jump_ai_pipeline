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

// so now let's test analyzeCodeForTests mocking all that we need to with rewire AI!
