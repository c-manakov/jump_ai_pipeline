const path = require("path");
const fs = require("fs");

const { findCodeInPatch, shouldIgnoreFile, loadIgnorePatterns } = require("../src/index");

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

// perfect, thank you, that works. Now let's test formatSuggestionIndentation AI!
