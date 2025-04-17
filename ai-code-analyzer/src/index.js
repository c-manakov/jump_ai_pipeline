const core = require("@actions/core");
const github = require("@actions/github");
const { Anthropic } = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
const { marked } = require("marked");

async function run() {
  try {
    console.log("=== AI Code Analyzer starting ===");
    console.log("Node version:", process.version);
    console.log("Current directory:", process.cwd());

    // For GitHub Actions:
    const githubToken = core.getInput("github-token", { required: true }) || process.env.GITHUB_TOKEN; 
    const anthropicApiKey =
      core.getInput("anthropic-api-key") || process.env.ANTHROPIC_API_KEY;
    const rulesPath = core.getInput("rules-path") || ".ai-code-rules";

    // For local development:
    // const githubToken = process.env.GITHUB_TOKEN;
    // const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    // const rulesPath = process.env.RULES_PATH || '../.ai-code-rules';

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
    console.log("- rules-path:", rulesPath);

    // For GitHub Actions:
    const octokit = github.getOctokit(githubToken);
    const context = github.context;
    const { owner, repo } = context.repo;
    const pullNumber = context.payload.pull_request?.number;
    console.log(context.payload.pull_request);

    // For local development:
    // const { Octokit } = require('@octokit/rest');
    // const octokit = new Octokit({ auth: githubToken });

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    // const owner = process.env.GITHUB_OWNER;
    // const repo = process.env.GITHUB_REPO;
    // const pullNumber = parseInt(process.env.PR_NUMBER, 10);

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

    // Load rules
    const rules = await loadRules(rulesPath);
    if (rules.length === 0) {
      console.log(`No rules found in ${rulesPath}`);
      return;
    }

    console.log(`Loaded ${rules.length} rules from ${rulesPath}`);

    // Process each file in the PR
    for (const file of files) {
      if (file.status === "removed") continue;

      // Extract added lines
      const addedLines = extractAddedLines(file.patch);
      if (addedLines.length === 0) continue;

      console.log(
        `Analyzing ${file.filename} (${addedLines.length} added lines)`,
      );

      // Analyze code with Claude
      const analysis = await analyzeCode(
        anthropic,
        addedLines.join("\n"),
        rules,
      );

      // Post comments if issues found
      if (analysis.issues.length > 0) {
        await postComments(octokit, owner, repo, pullNumber, file, analysis);
      }
    }

    console.log("AI code analysis completed");
  } catch (error) {
    console.error("Action failed with error:", error);
    console.error("Stack trace:", error.stack);
    core.setFailed(`Action failed: ${error.message}`);
  }
}

async function loadRules(rulesPath) {
  const rules = [];

  // Find all markdown files in the rules directory
  const files = glob.sync(`${rulesPath}/**/*.md`);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(process.cwd(), file);

    // Parse markdown to get title and description
    const tokens = marked.lexer(content);
    const title =
      tokens.find((t) => t.type === "heading" && t.depth === 1)?.text ||
      path.basename(file, ".md");

    rules.push({
      id: path.basename(file, ".md"),
      title,
      content,
      path: relativePath,
    });
  }

  return rules;
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

async function analyzeCode(anthropic, code, rules) {
  // Prepare rules text for the prompt
  const rulesText = rules
    .map((rule) => `## ${rule.title}\n${rule.content}`)
    .join("\n\n");

  // Create the prompt for Claude
  const prompt = `
You are a code reviewer checking if code follows specific rules.

# Rules to check:
${rulesText}

# Code to analyze:
\`\`\`
${code}
\`\`\`

Analyze the code and identify any violations of the rules. For each violation:
1. Identify the specific rule that was violated
2. Explain why it violates the rule
3. Suggest a specific code change to fix the issue
4. Include the line number or code snippet where the violation occurs
5. The suggestion should be actual code, while the explanation should go into explanation

Format your response as JSON:
{
  "issues": [
    {
      "rule_id": "rule-id",
      "line": "problematic code line",
      "explanation": "why this violates the rule",
      "suggestion": "suggested code fix"
    }
  ]
}

If no issues are found, return {"issues": []}.
`;

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-latest",
    max_tokens: 4000,
    system:
      "You are a code review assistant that identifies violations of coding rules and suggests fixes.",
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
    return { issues: [] };
  }
}

async function postComments(octokit, owner, repo, pullNumber, file, analysis) {
  // Get the latest commit ID from the PR
  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  
  const latestCommitId = pullRequest.head.sha;
  console.log(`Using latest commit ID from PR: ${latestCommitId}`);
  
  for (const issue of analysis.issues) {
    // Find the line in the file
    const lineNumber = findLineNumber(file.patch, issue.line);
    if (!lineNumber) continue;

    const body = `## AI Code Review: ${issue.rule_id}

${issue.explanation}

### Suggestion:
\`\`\`suggestion
${issue.suggestion}
\`\`\`

[View rule](${issue.rule_id}.md)`;

    console.log(`Posting comment on ${file.filename}:${lineNumber} with commit ID ${latestCommitId}`);
    
    try {
      // Create a review comment
      await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: latestCommitId,
        path: file.filename,
        line: lineNumber,
      });

      console.log(`Posted comment on ${file.filename}:${lineNumber}`);
    } catch (error) {
      console.error(`Error posting comment: ${error.message}`);
      console.error(error);
    }
  }
}

function findLineNumber(patch, codeLine) {
  if (!patch) return null;

  const lines = patch.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse the @@ -a,b +c,d @@ line to get the starting line number
      const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      // Check if this added line matches our code line
      if (line.substring(1).trim() === codeLine.trim()) {
        return currentLine;
      }
      currentLine++;
    } else if (!line.startsWith("-") && !line.startsWith("---")) {
      // Context lines and other non-removed lines increment the line counter
      currentLine++;
    }
  }

  return null;
}

run();
