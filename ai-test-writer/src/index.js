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
    // const githubToken =
    //   core.getInput("github-token", { required: true }) ||
    //   process.env.GITHUB_TOKEN;
    // const anthropicApiKey =
    //   core.getInput("anthropic-api-key") || process.env.ANTHROPIC_API_KEY;
    // const coveragePath = core.getInput("coverage-path") || "cover/coverage.json";

    // For local development:
    const githubToken = process.env.GITHUB_TOKEN;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const coveragePath = "../cover/coverage.json";

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

    // For GitHub Actions:
    // const octokit = github.getOctokit(githubToken);
    // const context = github.context;
    // const { owner, repo } = context.repo;
    // const pullNumber = context.payload.pull_request?.number;
    // console.log(context.payload.pull_request);

    // For local development:
    const { Octokit } = require("@octokit/rest");
    const octokit = new Octokit({ auth: githubToken });
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const pullNumber = parseInt(process.env.PR_NUMBER, 10);

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
    console.log(sourceToTestMap);

    // Process each file in the PR
    for (const file of files) {
      if (file.status === "removed") continue;

      // Only process Elixir files
      if (!file.filename.endsWith(".ex") && !file.filename.endsWith(".exs")) {
        console.log(`Skipping non-Elixir file: ${file.filename}`);
        continue;
      }

      // Extract added lines
      const addedLines = extractAddedLines(file.patch);
      console.log(addedLines)
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
        const resolvedPath = path.resolve(process.cwd(), "..", file.filename);
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
      );

      // Post comments if test suggestions found
      if (analysis.suggestions.length > 0) {
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

  console.log(lines)
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      // Remove the leading '+' and add to our collection
      addedLines.push(line.substring(1));
    }
  }
  console.log(addedLines)

  return addedLines;
}

async function analyzeCodeForTests(
  anthropic,
  code,
  coverageData,
  uncoveredLines = [],
  fullFileContent = "",
) {
  // Create the prompt for Claude
  const prompt = `
You are a test writing assistant that helps developers improve their test coverage.

${
  fullFileContent
    ? `
# Full file content for context:
\`\`\`
${fullFileContent}
\`\`\`
`
    : ""
}

# Code changes to analyze:
\`\`\`
${code}
\`\`\`

${
  coverageData
    ? `
# Current coverage data:
\`\`\`json
${JSON.stringify(coverageData, null, 2)}
\`\`\`

# Uncovered lines:
${uncoveredLines.length > 0 ? uncoveredLines.join(", ") : "None detected"}
`
    : "# No coverage data available for this file."
}

Analyze the code and suggest tests that would improve coverage. For each suggestion:
1. Identify the specific function or code block that needs testing
2. Explain why testing this is important
3. Provide a specific test case implementation that would test this code
4. Make sure the test follows best practices and is well-structured

Format your response as JSON:
{
  "suggestions": [
    {
      "target": "name of function or code block to test",
      "explanation": "why this needs testing",
      "test_code": "suggested test implementation"
    }
  ]
}

If no test suggestions are needed, return {"suggestions": []}.
`;

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-latest",
    max_tokens: 4000,
    system:
      "You are a test writing assistant that helps developers improve their test coverage.",
    messages: [{ role: "user", content: prompt }],
  });

  // Parse the response
  try {
    // Extract JSON from the response
    const responseText = message.content[0].text;
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

  for (const suggestion of analysis.suggestions) {
    const body = `## AI Test Suggestion for: ${suggestion.target}

${suggestion.explanation}

### Suggested Test:
\`\`\`elixir
${suggestion.test_code}
\`\`\`
`;

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
        `Posted test suggestion for ${suggestion.target} in ${file.filename}`,
      );
    } catch (error) {
      console.error(`Error posting test suggestion: ${error.message}`);
      console.error(error);
    }
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
    // For local development, we can use the filesystem
    if (process.env.NODE_ENV === 'development') {
      const files = [];
      const rootDir = path.resolve(process.cwd(), '..');
      
      // Simple recursive function to get all files
      const getFilesRecursively = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);
          
          // Skip hidden directories and node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '_build' || entry.name === 'deps') {
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
      tree_sha: 'HEAD',
      recursive: '1'
    });
    
    const files = repoContent.tree
      .filter(item => item.type === 'blob')
      .map(item => item.path);
    
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
  const elixirFiles = repoFiles.filter(file => 
    file.endsWith('.ex') || file.endsWith('.exs')
  );
  
  // Separate test files from source files
  const testFiles = elixirFiles.filter(file => 
    file.includes('_test.exs') || file.includes('/test/') || file.startsWith('test/')
  );
  const sourceFiles = elixirFiles.filter(file => 
    !file.includes('_test.exs') && !file.includes('/test/') && !file.startsWith('test/')
  );
  
  console.log(`Found ${sourceFiles.length} source files and ${testFiles.length} test files`);
  
  // If there are too many files, we might need to process them in batches
  if (sourceFiles.length > 50) {
    console.log("Too many source files to process at once, using heuristic matching instead");
    return createHeuristicSourceToTestMap(sourceFiles, testFiles);
  }
  
  // Create a prompt for Claude to map source files to test files
  const prompt = `
You are a code organization expert. I need you to map source files to their corresponding test files in an Elixir project.

# Source files:
${sourceFiles.join('\n')}

# Test files:
${testFiles.join('\n')}

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
      system: "You are a code organization assistant that maps source files to test files.",
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
    // Convert lib/app/module.ex to test/app/module_test.exs
    let expectedTestFile = sourceFile
      .replace(/^lib\//, 'test/')
      .replace(/\.ex$/, '_test.exs');
    
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

run();
