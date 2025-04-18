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
    const githubToken =
      core.getInput("github-token", { required: true }) ||
      process.env.GITHUB_TOKEN;
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

    // Load ignore patterns if .ai-analyzer-ignore exists
    const ignorePatterns = loadIgnorePatterns();

    // Process each file in the PR
    for (const file of files) {
      // Skip files that match ignore patterns
      if (shouldIgnoreFile(file.filename, ignorePatterns)) {
        console.log(`Skipping ignored file: ${file.filename}`);
        continue;
      }

      if (file.status === "removed") continue;

      // Extract added lines
      const addedLines = extractAddedLines(file.patch);
      if (addedLines.length === 0) continue;

      // Read the full file content from the filesystem
      let fullFileContent = "";
      try {
        fullFileContent = fs.readFileSync(file.filename, "utf8");
      } catch (error) {
        console.log(
          `Warning: Could not read file ${file.filename}: ${error.message}`,
        );
      }

      console.log(
        `Analyzing ${file.filename} (${addedLines.length} added lines)`,
      );

      // Analyze code with Claude
      const analysis = await analyzeCode(
        anthropic,
        addedLines.join("\n"),
        rules,
        fullFileContent,
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

async function analyzeCode(anthropic, code, rules, fullFileContent = "") {
  // Prepare rules text for the prompt
  const rulesText = rules
    .map((rule) => `## ${rule.title}\n${rule.content}`)
    .join("\n\n");

  const prompt = `
You are an expert and careful software engineer checking if code follows specific rules.

# Rules to check:
${rulesText}

# Code to analyze (newly added lines):
\`\`\`
${code}
\`\`\`

${
  fullFileContent
    ? `# Full file context (for reference only):
\`\`\`
${fullFileContent}
\`\`\`
`
    : ""
}

IMPORTANT: Only analyze the code shown in the "Code to analyze" section, which represents newly added lines in a pull request. Focus exclusively on these lines when identifying rule violations. The full file context is provided only for reference to understand the surrounding code when providing the suggestion.

Analyze the code and identify any violations of the rules. For each violation:
1. Carefully identify the specific rule that was violated. If the rule was not provided above then ignore the violation
2. Explain why it violates the rule
3. Include the exact problematic code snippet that violates the rule
4. Suggest a specific code change to fix the issue but only if it changes the code in meaningful way. Do NOT create suggestions that would leave the code the same as before. If the suggestion is to remove the code, provide none.

Format your response as JSON:
{
  "issues": [
    {
      "rule_id": "rule-id",
      "code": "the exact problematic code snippet",
      "explanation": "why this violates the rule",
      "suggestion": "(whitespaces as in the reference) suggested code fix"
    }
  ]
}

If no issues are found, return {"issues": []}.
`;
  console.log(prompt);

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-latest",
    max_tokens: 4000,
    system:
      "You are an expert software engineer that identifies violations of coding rules and suggests fixes.",
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
    console.log(analysis);

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
    // Find the line numbers for the problematic code
    const { startLine, endLine, originalIndentation } = findCodeInPatch(file.patch, issue.code);
    if (!startLine || !endLine) {
      console.log(`Could not find line numbers for issue in ${file.filename}`);
      continue;
    }

    // Apply the original indentation to the suggestion
    let formattedSuggestion = issue.suggestion;
    if (originalIndentation && issue.suggestion) {
      formattedSuggestion = issue.suggestion
        .split('\n')
        .map((line, index) => {
          // Don't add indentation to empty lines
          if (line.trim() === '') return '';
          // First line might already have correct indentation from the AI
          return index === 0 ? line : originalIndentation + line;
        })
        .join('\n');
    }

    const body = `## AI Code Review: ${issue.rule_id}

${issue.explanation}

### Suggestion:
\`\`\`suggestion
${formattedSuggestion || ''}
\`\`\`

[View rule](${issue.rule_id}.md)`;

    console.log(
      `Posting comment on ${file.filename}:${startLine}-${endLine} with commit ID ${latestCommitId}`,
    );

    try {
      // Create a review comment
      if (startLine === endLine) {
        await octokit.rest.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pullNumber,
          body,
          commit_id: latestCommitId,
          path: file.filename,
          line: endLine,
        });
      } else {
        await octokit.rest.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pullNumber,
          body,
          commit_id: latestCommitId,
          path: file.filename,
          start_line: startLine,
          line: endLine,
        });
      }

      console.log(`Posted comment on ${file.filename}:${startLine}-${endLine}`);
    } catch (error) {
      console.error(`Error posting comment: ${error.message}`);
      console.error(error);
    }
  }
}

function loadIgnorePatterns() {
  const ignoreFile = ".ai-analyzer-ignore";
  const patterns = [];

  try {
    if (fs.existsSync(ignoreFile)) {
      const content = fs.readFileSync(ignoreFile, "utf8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip empty lines and comments
        if (trimmedLine && !trimmedLine.startsWith("#")) {
          patterns.push(trimmedLine);
        }
      }

      console.log(
        `Loaded ${patterns.length} ignore patterns from ${ignoreFile}`,
      );
    } else {
      console.log(`No ${ignoreFile} file found, analyzing all files`);
    }
  } catch (error) {
    console.error(`Error loading ignore patterns: ${error.message}`);
  }

  return patterns;
}

function shouldIgnoreFile(filename, patterns) {
  if (!patterns || patterns.length === 0) return false;

  for (const pattern of patterns) {
    // Convert glob pattern to regex
    // This is a simplified version - for a full implementation, consider using a library like minimatch
    const regexPattern = pattern
      .replace(/\./g, "\\.") // Escape dots
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, ".") // Convert ? to .
      .replace(/\//g, "\\/"); // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);

    // Check if filename matches the pattern
    if (regex.test(filename)) {
      return true;
    }

    // Also check if any directory in the path matches
    const parts = filename.split("/");
    for (let i = 1; i < parts.length; i++) {
      const partialPath = parts.slice(0, i).join("/");
      if (regex.test(partialPath)) {
        return true;
      }
    }
  }

  return false;
}

function findCodeInPatch(patch, codeSnippet) {
  if (!patch || !codeSnippet) return { startLine: null, endLine: null, originalIndentation: null };

  // Store the original code snippet for indentation analysis
  const originalLines = codeSnippet.split("\n");
  
  // Normalize the code snippet by trimming each line
  const normalizedSnippet = codeSnippet
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (normalizedSnippet.length === 0) return { startLine: null, endLine: null, originalIndentation: null };

  const lines = patch.split("\n");
  let currentLine = 0;
  let startLine = null;
  let endLine = null;
  let matchedLines = 0;
  let inMatch = false;

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
      const trimmedLine = line.substring(1).trim();

      // Check if this line matches the start of our code snippet
      if (!inMatch && trimmedLine === normalizedSnippet[0]) {
        startLine = currentLine;
        matchedLines = 1;
        inMatch = true;

        // If the snippet is only one line, we're done
        if (normalizedSnippet.length === 1) {
          endLine = currentLine;
          break;
        }
      }
      // Check if we're in the middle of matching a multi-line snippet
      else if (inMatch && matchedLines < normalizedSnippet.length) {
        if (trimmedLine === normalizedSnippet[matchedLines]) {
          matchedLines++;

          // If we've matched all lines, we're done
          if (matchedLines === normalizedSnippet.length) {
            endLine = currentLine;
            break;
          }
        } else {
          // Reset if the sequence is broken
          inMatch = false;
          matchedLines = 0;
          startLine = null;

          // Check if this line could be the start of a new match
          if (trimmedLine === normalizedSnippet[0]) {
            startLine = currentLine;
            matchedLines = 1;
            inMatch = true;
          }
        }
      }

      currentLine++;
    } else if (!line.startsWith("-") && !line.startsWith("---")) {
      // Context lines and other non-removed lines increment the line counter
      currentLine++;

      // Reset match if we encounter a context line in the middle of matching
      if (inMatch && matchedLines < normalizedSnippet.length) {
        inMatch = false;
        matchedLines = 0;
        startLine = null;
      }
    }
  }

  // Handle case where we only matched a single line or partial match
  if (startLine !== null && endLine === null) {
    if (normalizedSnippet.length === 1) {
      endLine = startLine;
    } else {
      // We didn't find a complete match
      return { startLine: null, endLine: null };
    }
  }

  // Extract indentation from the original code snippet
  let originalIndentation = null;
  if (startLine !== null && originalLines.length > 0) {
    const firstLine = originalLines[0];
    const match = firstLine.match(/^(\s+)/);
    if (match) {
      originalIndentation = match[1];
    }
  }

  return { startLine, endLine, originalIndentation };
}

run();
