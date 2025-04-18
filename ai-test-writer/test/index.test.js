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

// cool, now let's test generateRepoMap and mock fs.readdirSync AI!
