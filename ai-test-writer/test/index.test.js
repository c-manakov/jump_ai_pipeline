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
      
      // make it much smaller, we don't need that much AI!
      // Mock a realistic project structure
      if (dir.includes("test/app")) {
        return createEntries(["accounts_test.exs", "users_test.exs"]);
      } else if (dir.includes("test/app_web")) {
        return createEntries(["controllers", "views"]);
      } else if (dir.includes("test")) {
        return createEntries(["app", "app_web", "support", "test_helper.exs"]);
      } else if (dir.includes("lib/app/accounts")) {
        return createEntries(["user.ex", "account.ex"]);
      } else if (dir.includes("lib/app")) {
        return createEntries(["accounts.ex", "accounts"]);
      } else if (dir.includes("lib/app_web/controllers")) {
        return createEntries(["user_controller.ex", "page_controller.ex"]);
      } else if (dir.includes("lib/app_web")) {
        return createEntries(["controllers", "views", "router.ex"]);
      } else if (dir.includes("lib")) {
        return createEntries(["app", "app_web"]);
      } else if (dir === path.resolve(process.cwd(), "..") || dir === "") {
        return createEntries(["lib", "test", "config", "mix.exs", "node_modules", ".git"]);
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
    
    expect(result).toContain("lib/app/accounts.ex");
    expect(result).toContain("lib/app/users.ex");
    expect(result).not.toContain("node_modules");
    expect(result).not.toContain(".git");
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
