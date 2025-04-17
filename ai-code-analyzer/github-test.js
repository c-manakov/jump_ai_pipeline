const core = require('@actions/core');
const github = require('@actions/github');
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const dotenv = require('dotenv');

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

// this mocking with global won't work, what we can do is we can comment out the lines in the index file that get all those inputs and just hardcode them for testing, it's fine AI!
// Mock @actions/core functions for local testing
global.core = {
  getInput: (name, options) => {
    if (name === 'github-token') return process.env.GITHUB_TOKEN;
    if (name === 'anthropic-api-key') return process.env.ANTHROPIC_API_KEY;
    if (name === 'rules-path') return process.env.RULES_PATH || '.ai-code-rules';
    if (options?.required) throw new Error(`Input required and not supplied: ${name}`);
    return '';
  },
  setFailed: (message) => {
    console.error(`::error::${message}`);
  },
  info: (message) => {
    console.log(message);
  },
  debug: (message) => {
    console.log(`DEBUG: ${message}`);
  },
  warning: (message) => {
    console.log(`WARNING: ${message}`);
  }
};

// Mock @actions/github context for local testing
const { Octokit } = require('@octokit/rest');
global.github = {
  context: {
    repo: {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO
    },
    payload: {
      pull_request: {
        number: parseInt(process.env.PR_NUMBER, 10)
      }
    }
  },
  getOctokit: (token) => {
    return new Octokit({ auth: token });
  }
};

// Import the actual action code
const actionPath = path.join(__dirname, 'src', 'index.js');
console.log(`Loading action from ${actionPath}`);
require(actionPath);

