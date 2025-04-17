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

    // Write the event data to a file
    const eventFile = path.join(__dirname, "test-pr-event.json");
    fs.writeFileSync(eventFile, JSON.stringify(eventData, null, 2));
    console.log("Created test PR event file");

    const projectRoot = path.resolve(__dirname, "..");
    console.log("Project root:", projectRoot);

    // Initialize act-js
    const act = new Act(
      projectRoot, // Run from the current directory
      ".github/workflows", // Path to workflow files
    );

    // Build the action first
    console.log("Building the action...");
    const { execSync } = require("child_process");
    execSync("npm run build", { stdio: "inherit", cwd: __dirname });

    // Set up secrets and inputs
    act
      .setSecret("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY)
      .setSecret("GITHUB_TOKEN", "fake-token")
      .setInput("github-token", "fake-token")
      .setInput("anthropic-api-key", process.env.ANTHROPIC_API_KEY)
      .setEvent(eventData);

    // List available workflows
    console.log("Available workflows:");
    const workflows = await act.list("pull_request", projectRoot);
    workflows.forEach((wf) => {
      console.log(`- ${wf.workflowName} (${wf.jobId}) in ${wf.workflowFile}`);
    });

    // Run the workflow
    console.log("\nRunning AI code review workflow...");
    const results = await act.runEvent("pull_request", {
      artifactServer: {
        path: path.join(__dirname, "artifacts"),
        port: "8080",
      },
      verbose: true,
    });

    // Display results
    console.log("\nWorkflow execution completed");
    console.log("Results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Error running act-js:", error);
    process.exit(1);
  }
}

main();
