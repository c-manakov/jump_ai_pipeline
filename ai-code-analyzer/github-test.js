const { Octokit } = require('@octokit/rest');
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const dotenv = require('dotenv');

// this file should not do a whole separate thing, it should run the actual action that we have in index.js AI!

// Load environment variables from .env file
dotenv.config();

// Check required environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPO', 'GITHUB_OWNER', 'PR_NUMBER'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set them in your .env file or environment');
  process.exit(1);
}

// Initialize clients
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const pullNumber = parseInt(process.env.PR_NUMBER, 10);
const rulesPath = process.env.RULES_PATH || '.ai-code-rules';

async function loadRules(rulesPath) {
  const rules = [];
  
  // Find all markdown files in the rules directory
  const files = glob.sync(`../${rulesPath}/**/*.md`);
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(process.cwd(), file);
    
    // Parse the markdown to extract the title (first h1)
    const titleMatch = content.match(/^# (.*)$/m);
    const title = titleMatch ? titleMatch[1] : path.basename(file, '.md');
    
    rules.push({
      id: path.basename(file, '.md'),
      title,
      content,
      path: relativePath
    });
  }
  
  return rules;
}

function extractAddedLines(patch) {
  if (!patch) return [];
  
  const lines = patch.split('\n');
  const addedLines = [];
  
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Remove the leading '+' and add to our collection
      addedLines.push(line.substring(1));
    }
  }
  
  return addedLines;
}

async function analyzeCode(anthropic, code, rules) {
  console.log(`Analyzing code with ${rules.length} rules`);
  
  // Prepare rules text for the prompt
  const rulesText = rules.map(rule => `## ${rule.title}\n${rule.content}`).join('\n\n');
  
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

  console.log("Sending request to Anthropic API...");
  
  try {
    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      system: "You are a code review assistant that identifies violations of coding rules and suggests fixes.",
      messages: [
        { role: "user", content: prompt }
      ]
    });
    
    console.log("Received response from Anthropic API");
    
    // Parse the response
    try {
      // Extract JSON from the response
      const responseText = message.content[0].text;
      console.log("Response text length:", responseText.length);
      
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) || 
                        responseText.match(/{[\s\S]*}/);
                        
      if (!jsonMatch) {
        console.error("Could not find JSON in response");
        console.log("Response text:", responseText);
        return { issues: [] };
      }
      
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;
      console.log("Extracted JSON:", jsonText.substring(0, 100) + "...");
      
      const analysis = JSON.parse(jsonText);
      console.log(`Parsed analysis with ${analysis.issues?.length || 0} issues`);
      
      return analysis;
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      console.error('Error details:', error.stack);
      return { issues: [] };
    }
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    console.error('Error details:', error.stack);
    return { issues: [] };
  }
}

function findLineNumber(patch, codeLine) {
  if (!patch) return null;
  
  const lines = patch.split('\n');
  let currentLine = 0;
  
  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse the @@ -a,b +c,d @@ line to get the starting line number
      const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      continue;
    }
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Check if this added line matches our code line
      if (line.substring(1).trim() === codeLine.trim()) {
        return currentLine;
      }
      currentLine++;
    } else if (!line.startsWith('-') && !line.startsWith('---')) {
      // Context lines and other non-removed lines increment the line counter
      currentLine++;
    }
  }
  
  return null;
}

async function postComments(octokit, owner, repo, pullNumber, file, analysis) {
  for (const issue of analysis.issues) {
    // Find the line in the file
    const lineNumber = findLineNumber(file.patch, issue.line);
    if (!lineNumber) {
      console.log(`Could not find line number for issue in ${file.filename}`);
      continue;
    }
    
    const body = `## AI Code Review: ${issue.rule_id}

${issue.explanation}

### Suggestion:
\`\`\`suggestion
${issue.suggestion}
\`\`\`

[View rule](${issue.rule_id}.md)`;
    
    console.log(`Posting comment on ${file.filename}:${lineNumber}`);
    
    try {
      // Create a review comment
      const response = await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: file.sha,
        path: file.filename,
        line: lineNumber
      });
      
      console.log(`Comment posted successfully, ID: ${response.data.id}`);
    } catch (error) {
      console.error(`Error posting comment: ${error.message}`);
      console.error(error);
    }
  }
}

async function main() {
  try {
    console.log(`Starting analysis of PR #${pullNumber} in ${owner}/${repo}`);
    
    // Get PR files
    console.log("Fetching PR files...");
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    console.log(`Found ${files.length} files in the PR`);
    
    // Load rules
    console.log(`Loading rules from ${rulesPath}...`);
    const rules = await loadRules(rulesPath);
    
    if (rules.length === 0) {
      console.log(`No rules found in ${rulesPath}`);
      return;
    }
    
    console.log(`Loaded ${rules.length} rules:`);
    rules.forEach(rule => console.log(`- ${rule.title} (${rule.id})`));
    
    // Process each file in the PR
    for (const file of files) {
      console.log(`\nProcessing ${file.filename} (status: ${file.status})`);
      
      if (file.status === 'removed') {
        console.log(`Skipping removed file`);
        continue;
      }
      
      // Extract added lines
      const addedLines = extractAddedLines(file.patch);
      
      if (addedLines.length === 0) {
        console.log(`No added lines, skipping`);
        continue;
      }
      
      console.log(`Found ${addedLines.length} added lines`);
      
      // Analyze code with Claude
      console.log(`Analyzing code...`);
      const analysis = await analyzeCode(anthropic, addedLines.join('\n'), rules);
      
      // Post comments if issues found
      if (analysis.issues && analysis.issues.length > 0) {
        console.log(`Found ${analysis.issues.length} issues`);
        await postComments(octokit, owner, repo, pullNumber, file, analysis);
      } else {
        console.log(`No issues found`);
      }
    }
    
    console.log('\nAI code analysis completed successfully');
    
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main();
