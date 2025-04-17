# AI Code Analyzer

A GitHub Action that uses Claude AI to analyze code changes in PRs against custom rules defined in markdown files.

## Features

- Analyzes code changes in pull requests
- Uses custom rules defined in markdown files
- Provides suggestions for fixing issues
- Adds comments directly to the PR

## Setup

1. Add the action to your workflow:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Run AI Code Analyzer
        uses: ./ai-code-analyzer
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

2. Add your rules in the `.ai-code-rules` directory as markdown files.

3. Add your Anthropic API key as a secret in your repository settings.

## Local Development

### Prerequisites

- Node.js 18+
- [act](https://github.com/nektos/act) for testing GitHub Actions locally

### Installation

```bash
# Install dependencies
npm install

# Install act (if not already installed)
# On macOS:
brew install act
# On Linux:
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

### Testing Locally

There are three ways to test the action locally:

#### 1. Using the local test script

This runs the core AI analysis functionality without GitHub integration:

```bash
# Create a .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env

# Run the local test
npm run test:local
```

#### 2. Using act to simulate GitHub Actions

This simulates the full GitHub Actions environment using nektos/act directly:

```bash
# Create a .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env

# Run the action with act
npm run test:act
```

#### 3. Using act-js to simulate GitHub Actions (Recommended)

This uses the act-js library to programmatically control the GitHub Actions simulation:

```bash
# Create a .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env

# Run the action with act-js
npm run test:actjs
```

The act-js approach gives you more control over the testing environment and makes it easier to debug issues.

## Creating Rules

Rules are defined as markdown files in the `.ai-code-rules` directory. Each rule should:

1. Have a clear title (H1)
2. Describe the anti-pattern to avoid
3. Provide good and bad examples
4. Explain why the rule is important

Example:

```markdown
# Avoid Complex Conditionals

Avoid complex conditional expressions. Break them down into multiple conditions with descriptive variable names.

## Bad Example

```javascript
if (user.isActive && user.age > 18 && (user.role === 'admin' || user.permissions.includes('edit'))) {
  // Do something
}
```

## Good Example

```javascript
const isAdult = user.age > 18;
const hasEditAccess = user.role === 'admin' || user.permissions.includes('edit');
const isEligible = user.isActive && isAdult && hasEditAccess;

if (isEligible) {
  // Do something
}
```

## Why?

Complex conditionals are hard to read and understand at a glance. Breaking them down into named variables makes the code more readable and self-documenting.
```
