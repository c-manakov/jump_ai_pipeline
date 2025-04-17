const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
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

// Import the actual action code
const actionPath = path.join(__dirname, 'src', 'index.js');
console.log(`Loading action from ${actionPath}`);
require(actionPath);
