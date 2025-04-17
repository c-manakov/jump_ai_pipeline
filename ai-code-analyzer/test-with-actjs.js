const { Act } = require("@kie/act-js");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

async function main() {
  try {
    // Check if ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
      console.error("Please set it in your .env file or environment");
      process.exit(1);
    }

    console.log("Setting up act-js for local GitHub Actions testing...");

    const projectRoot = path.resolve(__dirname);
    console.log("Project root:", projectRoot);
    
    // Create a sample PR event
    const eventData = {
      pull_request: {
        number: 1,
        head: {
          sha: "sample-sha",
        },
      },
      repository: {
        name: "test-repo",
        owner: {
          login: "test-owner",
        },
      },
    };

    // Build the action first
    console.log("Building the action...");
    const { execSync } = require("child_process");
    execSync("npm run build", { stdio: "inherit", cwd: projectRoot });

    // Initialize act-js with options
    const act = new Act({
      cwd: projectRoot,
      workflowPath: ".github/workflows",
      bind: true, // Bind the directory instead of copying for better performance
    });

    // Set up secrets and inputs
    act
      .setSecret("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY)
      .setSecret("GITHUB_TOKEN", "fake-token")
      .setInput("github-token", "fake-token")
      .setInput("anthropic-api-key", process.env.ANTHROPIC_API_KEY)
      .setEvent(eventData);

    // List available workflows
    console.log("\nAvailable workflows:");
    const workflows = await act.list("pull_request");
    
    if (workflows.length === 0) {
      console.error("No workflows found for pull_request event!");
      process.exit(1);
    }
    
    workflows.forEach((wf) => {
      console.log(`- ${wf.workflowName} (${wf.jobId}) in ${wf.workflowFile}`);
    });

    // Create artifacts directory if it doesn't exist
    const artifactsDir = path.join(projectRoot, "artifacts");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Run the workflow with more options
    console.log("\nRunning AI code review workflow...");
    const results = await act.runEvent("pull_request", {
      artifactServer: {
        path: artifactsDir,
        port: "8080",
      },
      logFile: path.join(projectRoot, "act-run.log"),
      verbose: true,
    });

    // Display results
    console.log("\nWorkflow execution completed");
    
    if (results && results.length > 0) {
      console.log("Workflow results:");
      results.forEach((result, index) => {
        console.log(`\nJob ${index + 1}:`);
        console.log(`- Status: ${result.status}`);
        console.log(`- Job ID: ${result.jobId}`);
        console.log(`- Workflow: ${result.workflowName}`);
      });
    } else {
      console.log("No results returned from workflow execution");
    }
  } catch (error) {
    console.error("Error running act-js:", error);
    process.exit(1);
  }
}

main();
