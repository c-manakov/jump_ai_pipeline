const core = require("@actions/core");
const github = require("@actions/github");
const { Anthropic } = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    console.log("=== AI Test Writer starting ===");
    console.log("Node version:", process.version);
    console.log("Current directory:", process.cwd());

    // For GitHub Actions:
    const githubToken =
      core.getInput("github-token", { required: true }) ||
      process.env.GITHUB_TOKEN;
    const anthropicApiKey =
      core.getInput("anthropic-api-key") || process.env.ANTHROPIC_API_KEY;
    const coveragePath =
      core.getInput("coverage-path") || "cover/coverage.json";

    const octokit = github.getOctokit(githubToken);
    const context = github.context;
    const { owner, repo } = context.repo;
    const pullNumber = context.payload.pull_request?.number;
    console.log(context.payload.pull_request);

    // For local development:
    // const { Octokit } = require("@octokit/rest");
    // const octokit = new Octokit({ auth: githubToken });
    // const owner = process.env.GITHUB_OWNER;
    // const repo = process.env.GITHUB_REPO;
    // const pullNumber = parseInt(process.env.PR_NUMBER, 10);
    //
    // const githubToken = process.env.GITHUB_TOKEN;
    // const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    // const coveragePath = "../cover/coverage.json";

    if (!githubToken) {
      throw new Error(
        "GitHub token is required. Please set GITHUB_TOKEN environment variable.",
      );
    }

    if (!anthropicApiKey) {
      throw new Error(
        "Anthropic API key is required. Please set ANTHROPIC_API_KEY environment variable.",
      );
    }

    console.log("Inputs received:");
    console.log("- github-token:", githubToken ? "✓ (set)" : "✗ (not set)");
    console.log(
      "- anthropic-api-key:",
      anthropicApiKey ? "✓ (set)" : "✗ (not set)",
    );
    console.log("- coverage-path:", coveragePath);

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    if (!owner || !repo || isNaN(pullNumber)) {
      throw new Error(
        "Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, or PR_NUMBER",
      );
    }

    console.log(`Processing PR #${pullNumber} in ${owner}/${repo}`);

    // Get PR diff
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });

    // Load coverage data
    let coverageData = [];
    try {
      if (fs.existsSync(coveragePath)) {
        const coverageContent = fs.readFileSync(coveragePath, "utf8");
        coverageData = JSON.parse(coverageContent);
        console.log(`Loaded coverage data from ${coveragePath}`);
      } else {
        console.log(`Coverage file not found at ${coveragePath}`);
      }
    } catch (error) {
      console.error(`Error loading coverage data: ${error.message}`);
    }

    // so what we also now need to do before we actually analyze any of the files is as follows:
    // Generate a repository map and find test files for source files
    const repoMap = await generateRepoMap(octokit, owner, repo);
    const sourceToTestMap = await mapSourceFilesToTestFiles(anthropic, repoMap);

    console.log("Source to test file mapping:");

    // Process each file in the PR
    for (const file of files) {
      if (file.status === "removed") continue;

      // Only process Elixir files
      if (!file.filename.endsWith(".ex")) {
        console.log(`Skipping non-ex file: ${file.filename}`);
        continue;
      }

      // Extract added lines
      const addedLines = extractAddedLines(file.patch);
      if (addedLines.length === 0) continue;

      console.log(
        `Analyzing ${file.filename} (${addedLines.length} added lines)`,
      );

      // Find coverage data for this file
      const fileCoverage = coverageData.find(
        (item) => item.file === file.filename,
      );

      // Get the full file content for better context
      let fileContent = "";
      try {
        // Read file content from filesystem
        const parentDir = path.resolve(process.cwd(), "..");
        console.log(`Parent directory contents (${parentDir}):`);
        const dirContents = fs.readdirSync(parentDir);
        console.log(dirContents);

        const resolvedPath = path.resolve(process.cwd(), file.filename);
        fileContent = fs.readFileSync(resolvedPath, "utf8");
        console.log(
          `Read full content for ${file.filename} (${fileContent.length} chars)`,
        );
      } catch (error) {
        console.log(
          `Could not retrieve full content for ${file.filename}: ${error.message}`,
        );
      }

      // Extract uncovered lines from coverage data
      let uncoveredLines = [];
      if (fileCoverage && fileCoverage.lines) {
        uncoveredLines = fileCoverage.lines
          .filter((line) => line[1] === false) // Get only uncovered lines
          .map((line) => line[0]); // Extract line numbers

        console.log(
          `Found ${uncoveredLines.length} uncovered lines in ${file.filename}`,
        );
      }

      // Analyze code with Claude and suggest tests
      const analysis = await analyzeCodeForTests(
        anthropic,
        addedLines.join("\n"),
        fileCoverage,
        uncoveredLines,
        fileContent,
        sourceToTestMap,
        file,
      );

      // Post comments if test suggestions found
      if (analysis.tests && analysis.tests.length > 0) {
        await postTestSuggestions(
          octokit,
          owner,
          repo,
          pullNumber,
          file,
          analysis,
        );
      }
    }

    // Implement all queued test files in a single commit
    if (pendingTestFiles.length > 0) {
      console.log(`Implementing ${pendingTestFiles.length} queued test files...`);
      await implementPendingTestFiles(octokit, owner, repo, pullNumber);
    }

    console.log("AI test analysis completed");
  } catch (error) {
    console.error("Action failed with error:", error);
    console.error("Stack trace:", error.stack);
    core.setFailed(`Action failed: ${error.message}`);
  }
}

function extractAddedLines(patch) {
  if (!patch) return [];

  const lines = patch.split("\n");
  const addedLines = [];

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      // Remove the leading '+' and add to our collection
      addedLines.push(line.substring(1));
    }
  }

  return addedLines;
}

async function analyzeCodeForTests(
  anthropic,
  code,
  coverageData,
  uncoveredLines = [],
  fullFileContent = "",
  sourceToTestMap = {},
  file = {},
) {
  // Get the corresponding test file if it exists
  let testFileContent = "";
  let testFileExists = false;

  if (sourceToTestMap && file.filename) {
    const testFilePath = sourceToTestMap[file.filename];
    if (testFilePath) {
      try {
        const resolvedTestPath = path.resolve(process.cwd(), testFilePath);
        testFileContent = fs.readFileSync(resolvedTestPath, "utf8");
        testFileExists = true;
        console.log(`Found and loaded test file: ${testFilePath}`);
      } catch (error) {
        console.log(
          `Test file exists in mapping but couldn't be read: ${error.message}`,
        );
      }
    }
  }

  // Enhance the full file content by marking uncovered lines
  let enhancedFileContent = fullFileContent;
  if (fullFileContent && uncoveredLines.length > 0) {
    const lines = fullFileContent.split("\n");
    uncoveredLines.forEach((lineNum) => {
      if (lineNum > 0 && lineNum <= lines.length) {
        lines[lineNum - 1] = lines[lineNum - 1] + " # UNCOVERED";
      }
    });
    enhancedFileContent = lines.join("\n");
  }

  // Skip analysis if no coverage data and no code changes
  if (
    (!coverageData || !coverageData.lines || coverageData.lines.length === 0) &&
    (!code || code.trim() === "")
  ) {
    console.log(
      `Skipping analysis for ${file.filename}: No coverage data or code changes`,
    );
    return { suggestions: [] };
  }

  // Create the prompt for Claude
  const prompt = `
You are an expert automated QA engineer that helps developers improve their test coverage.

${
  enhancedFileContent
    ? `
# Full file content for context (lines marked with "# UNCOVERED" need test coverage):
\`\`\`
${enhancedFileContent}
\`\`\`
`
    : ""
}

${
  testFileExists
    ? `
# Existing test file content:
\`\`\`
${testFileContent}
\`\`\`
`
    : "# No existing test file found for this module."
}

# Code changes to analyze:
\`\`\`
${code}
\`\`\`

# Test file path:
${sourceToTestMap[file.filename] || `test/${file.filename.replace(/^lib\//, "").replace(/\.ex$/, "_test.exs")}`}

Analyze the code and suggest tests that would improve coverage. Focus ONLY on uncovered lines that were added in the current commit (these are the lines in the "Code changes to analyze" section that are also marked with "# UNCOVERED" in the full file content).

Do NOT create tests for uncovered lines that aren't in the code changes provided above.

For the test file:
1. Provide the COMPLETE test file content as it should appear after your changes
2. If creating a new file, provide the entire file content
3. If modifying an existing file, provide the entire file with your additions integrated properly

For each test you add:
1. Identify the specific function or code block that needs testing
2. Explain why testing this is important
3. Rate your confidence from 1-5 that this test will work without modifications
   - Be conservative in your confidence ratings
   - Consider 3 as the default for most tests
   - Only use 4-5 for extremely simple and straightforward cases
   - Use 1-2 for complex cases involving external dependencies, concurrency, randomness or mocking

Format your response as JSON:
{
  "create_new_file": ${!testFileExists},
  "test_file_path": "${testFileExists ? sourceToTestMap[file.filename] || "" : sourceToTestMap[file.filename] || `test/${file.filename.replace(/^lib\//, "").replace(/\.ex$/, "_test.exs")}`}",
  "complete_test_file": "entire test file content with new tests integrated",
  "tests": [
    {
      "target": "name of function or code block to test",
      "explanation": "why this needs testing",
      "confidence": 2
    }
  ],
  "lowest_confidence": 2
}

If no test suggestions are needed, return {"suggestions": []}.
${!testFileExists ? "If a new test file needs to be created, include complete file structure with all necessary imports and setup code." : "For existing test files, integrate your new tests with the existing test structure."}
`;

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-latest",
    max_tokens: 4000,
    system:
      "You are an expert automated QA engineer that helps developers improve their test coverage.",
    messages: [{ role: "user", content: prompt }],
  });

  // Parse the response
  try {
    // Extract JSON from the response
    const responseText = message.content[0].text;
    console.log(responseText);
    const jsonMatch =
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/{[\s\S]*}/);

    const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;
    const analysis = JSON.parse(jsonText);
    return analysis;
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    return { suggestions: [] };
  }
}

async function postTestSuggestions(
  octokit,
  owner,
  repo,
  pullNumber,
  file,
  analysis,
) {
  // Get the latest commit ID from the PR
  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const latestCommitId = pullRequest.head.sha;
  console.log(`Using latest commit ID from PR: ${latestCommitId}`);

  // Determine action based on confidence level
  const confidenceLevel = analysis.lowest_confidence || 0;
  const actionType =
    confidenceLevel >= 4
      ? "Automatic Implementation"
      : confidenceLevel === 3
        ? "Suggested Implementation"
        : "Manual Implementation Required";

  // Create a summary of the tests
  const testSummary = analysis.tests
    ? analysis.tests
        .map(
          test => `- **${test.target}** (Confidence: ${test.confidence}/5): ${test.explanation.split('.')[0]}.`
        )
        .join('\n')
    : '';

  const body = `## AI Test Suggestions

${testSummary}

### Overall Confidence Level: ${confidenceLevel}/5
${actionType}${confidenceLevel >= 4 ? ' (Will be automatically implemented)' : ''}

### Complete Test File:
\`\`\`elixir
${analysis.complete_test_file}
\`\`\`

${
  analysis.create_new_file
    ? `
### Note: This ${confidenceLevel >= 4 ? 'will create' : 'requires creating'} a new test file at \`${analysis.test_file_path || "test/path/to/new_test_file.exs"}\`
`
    : `
### This ${confidenceLevel >= 4 ? 'will update' : 'updates'} the existing test file: \`${analysis.test_file_path || "test/path/to/existing_test_file.exs"}\`
`
}`;

  try {
    // Create a review comment at the end of the file
    await octokit.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      commit_id: latestCommitId,
      path: file.filename,
      line: getLastLineNumber(file.patch),
    });

    console.log(
      `Posted test suggestions for ${file.filename} (overall confidence: ${confidenceLevel}/5)`,
    );

    // If confidence is high (4-5), queue the test file for implementation
    if (confidenceLevel >= 4) {
      console.log(
        `High confidence tests - eligible for automatic implementation`,
      );
      // Queue the test file for implementation
      await queueTestFileForImplementation(
        analysis.test_file_path,
        analysis.complete_test_file,
        file.filename
      );
    }
  } catch (error) {
    console.error(`Error posting test suggestion: ${error.message}`);
    console.error(error);
  }
}

function getLastLineNumber(patch) {
  if (!patch) return 1;

  const lines = patch.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse the @@ -a,b +c,d @@ line to get the starting line number and count
      const match = line.match(/@@ -\d+,\d+ \+(\d+),(\d+) @@/);
      if (match) {
        const startLine = parseInt(match[1], 10);
        const lineCount = parseInt(match[2], 10);
        currentLine = startLine + lineCount - 1;
      }
    }
  }

  return Math.max(currentLine, 1);
}

/**
 * Generate a map of all files in the repository
 */
async function generateRepoMap(octokit, owner, repo) {
  console.log("Generating repository file map...");

  try {
    // Always use the filesystem since the action has access to the repo
    {
      const files = [];
      const rootDir = path.resolve(process.cwd(), "..");

      // Simple recursive function to get all files
      const getFilesRecursively = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);

          // Skip hidden directories and node_modules
          if (
            entry.name.startsWith(".") ||
            entry.name === "node_modules" ||
            entry.name === "_build" ||
            entry.name === "deps"
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            getFilesRecursively(fullPath);
          } else if (entry.isFile()) {
            files.push(relativePath);
          }
        }
      };

      getFilesRecursively(rootDir);
      console.log(`Found ${files.length} files in the repository`);
      return files;
    }

    // For GitHub Actions, use the GitHub API
    const { data: repoContent } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: "HEAD",
      recursive: "1",
    });

    const files = repoContent.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path);

    console.log(`Found ${files.length} files in the repository`);
    return files;
  } catch (error) {
    console.error(`Error generating repo map: ${error.message}`);
    return [];
  }
}

/**
 * Map source files to their corresponding test files using AI
 */
async function mapSourceFilesToTestFiles(anthropic, repoFiles) {
  console.log("Mapping source files to test files...");

  // Filter to only include Elixir files
  const elixirFiles = repoFiles
    .filter((file) => file.endsWith(".ex") || file.endsWith(".exs"))
    .map((file) => {
      const parts = file.split("/");
      // If path starts with a project name folder, remove it
      if (parts.length > 1) {
        return parts.slice(1).join("/");
      }
      return file;
    });

  // Separate test files from source files
  const testFiles = elixirFiles.filter(
    (file) =>
      file.includes("_test.exs") ||
      file.includes("/test/") ||
      file.startsWith("test/"),
  );
  const sourceFiles = elixirFiles.filter(
    (file) =>
      !file.includes("_test.exs") &&
      !file.includes("/test/") &&
      !file.startsWith("test/") &&
      file.endsWith(".ex"),
  );

  console.log(
    `Found ${sourceFiles.length} source files and ${testFiles.length} test files`,
  );
  console.log(sourceFiles);
  console.log(testFiles);

  // If there are too many files, we might need to process them in batches
  if (sourceFiles.length > 150) {
    console.log(
      "Too many source files to process at once, using heuristic matching instead",
    );
    return createHeuristicSourceToTestMap(sourceFiles, testFiles);
  }

  // Create a prompt for Claude to map source files to test files
  const prompt = `
You are a code organization expert. I need you to map source files to their corresponding test files in an Elixir project.

# Source files:
${sourceFiles.join("\n")}

# Test files:
${testFiles.join("\n")}

For each source file, identify the most likely test file that would contain tests for it.
Follow these Elixir conventions:
1. A file at "lib/app/module.ex" is often tested in "test/app/module_test.exs"
2. A file at "lib/app_web/controllers/user_controller.ex" might be tested in "test/app_web/controllers/user_controller_test.exs"
3. Some modules might not have corresponding test files

Return your answer as a JSON object where:
- Keys are source file paths
- Values are either the corresponding test file path or null if no test file exists

Example:
{
  "lib/app/accounts.ex": "test/app/accounts_test.exs",
  "lib/app/accounts/user.ex": "test/app/accounts/user_test.exs",
  "lib/app_web/views/layout_view.ex": null
}
`;

  try {
    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4000,
      system:
        "You are a code organization assistant that maps source files to test files.",
      messages: [{ role: "user", content: prompt }],
    });

    // Parse the response
    const responseText = message.content[0].text;
    const jsonMatch =
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/{[\s\S]*}/);

    const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;
    const sourceToTestMap = JSON.parse(jsonText);

    console.log(sourceToTestMap);

    return sourceToTestMap;
  } catch (error) {
    console.error(`Error mapping source files to test files: ${error.message}`);
    // Fall back to heuristic matching
    return createHeuristicSourceToTestMap(sourceFiles, testFiles);
  }
}

/**
 * Create a mapping from source files to test files using heuristics
 */
function createHeuristicSourceToTestMap(sourceFiles, testFiles) {
  const sourceToTestMap = {};

  for (const sourceFile of sourceFiles) {
    // Handle paths with or without project prefix
    const parts = sourceFile.split("/");
    const projectPrefix =
      parts.length > 1 && parts[0].includes("_") ? parts[0] + "/" : "";
    const relativePath = projectPrefix ? parts.slice(1).join("/") : sourceFile;

    // Convert lib/app/module.ex to test/app/module_test.exs
    let expectedTestFile = relativePath
      .replace(/^lib\//, "test/")
      .replace(/\.ex$/, "_test.exs");

    // Add project prefix back if it existed
    if (projectPrefix) {
      expectedTestFile = projectPrefix + expectedTestFile;
    }

    // Check if the expected test file exists
    if (testFiles.includes(expectedTestFile)) {
      sourceToTestMap[sourceFile] = expectedTestFile;
    } else {
      // Try other heuristics or set to null if no match
      sourceToTestMap[sourceFile] = null;
    }
  }

  return sourceToTestMap;
}

/**
 * Collects test files to be implemented
 */
const pendingTestFiles = [];

/**
 * Adds a test file to the pending implementation queue
 */
async function queueTestFileForImplementation(
  testFilePath,
  testFileContent,
  sourceFilePath
) {
  console.log(`Queueing test file for implementation: ${testFilePath}`);
  
  pendingTestFiles.push({
    testFilePath,
    testFileContent,
    sourceFilePath
  });
  
  return true;
}

/**
 * Implements all queued test files in a single commit
 */
async function implementPendingTestFiles(
  octokit,
  owner,
  repo,
  pullNumber
) {
  if (pendingTestFiles.length === 0) {
    console.log("No test files to implement");
    return null;
  }
  
  console.log(`Implementing ${pendingTestFiles.length} test files in a single commit`);
  
  try {
    // Get the current branch name from the PR
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    const branchName = pullRequest.head.ref;
    console.log(`Target branch for commit: ${branchName}`);
    
    // Get the latest commit SHA to create a new tree based on it
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`
    });
    
    const latestCommitSha = refData.object.sha;
    console.log(`Latest commit SHA: ${latestCommitSha}`);
    
    // Get the commit that the latest commit points to
    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha
    });
    
    const treeSha = latestCommit.tree.sha;
    
    // Create blobs for each file
    const fileBlobs = await Promise.all(
      pendingTestFiles.map(async (file) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.testFileContent).toString('base64'),
          encoding: 'base64'
        });
        
        return {
          path: file.testFilePath,
          mode: '100644', // Regular file
          type: 'blob',
          sha: blob.sha
        };
      })
    );
    
    // Create a new tree with the new blobs
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: fileBlobs
    });
    
    // Create a commit with the new tree
    const sourceFiles = pendingTestFiles.map(file => file.sourceFilePath).join(', ');
    const commitMessage = `test: Add tests for ${sourceFiles} #ai-test`;
    
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha]
    });
    
    // Update the reference to point to the new commit
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
      sha: newCommit.sha
    });
    
    console.log(`Successfully implemented ${pendingTestFiles.length} test files in a single commit`);
    console.log(`Commit SHA: ${newCommit.sha}`);
    
    // Trigger workflow run to test the new tests
    try {
      console.log(`Triggering workflow run to test the new tests...`);
      await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: 'elixir-tests.yml',
        ref: branchName
      });
      console.log(`Successfully triggered workflow run`);
    } catch (error) {
      console.error(`Error triggering workflow run: ${error.message}`);
      // Non-fatal error, continue
    }
    
    // Clear the pending files
    pendingTestFiles.length = 0;
    
    return newCommit;
  } catch (error) {
    console.error(`Error implementing test files: ${error.message}`);
    console.error(error);
    return null;
  }
}

run();
