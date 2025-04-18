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

// now let's add a test for getLastLineNumber  AI!
