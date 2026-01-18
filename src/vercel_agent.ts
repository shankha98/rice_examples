import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { Client, statetool } from "rice-node-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (local .env overrides test .env)
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../tests/remote/.env") });

/**
 * Vercel AI SDK Agent Example
 *
 * Demonstrates using Rice SDK tools with Vercel AI SDK's tool calling.
 * Tools are created with execute functions bound to the StateClient.
 */

async function main() {
  console.log("Vercel AI SDK Agent with Rice Memory Tools");
  console.log("=".repeat(50));

  // Initialize Rice client
  const client = new Client({
    runId: `vercel-agent-${Date.now()}`,
    configPath: path.resolve(__dirname, "../rice.config.js"),
  });

  await client.connect();
  console.log("Connected to Rice State service\n");

  // Create Vercel AI SDK compatible tools bound to our client
  const tools = statetool.createVercelTools(client.state);

  console.log(`Created ${Object.keys(tools).length} tools for Vercel AI SDK`);
  console.log("Tools:", Object.keys(tools).join(", "));

  // =========================================================================
  // Example 1: Simple generateText with tools
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Example 1: generateText with memory tools");
  console.log("-".repeat(50));

  const result1 = await generateText({
    model: google("gemini-2.5-flash"),
    tools,
    stopWhen: stepCountIs(5),
    system: `You are a helpful assistant with persistent memory capabilities.
Use the memory tools to store and recall information.
- Use 'remember' to store important facts
- Use 'recall' to search your memories
- Use 'setVariable' and 'getVariable' for structured data
- Use 'addGoal' and 'listGoals' for task tracking`,
    prompt:
      "Please remember that my name is Sarah and I'm a data scientist working on NLP projects.",
  });

  console.log("\nSteps taken:", result1.steps.length);
  for (const step of result1.steps) {
    if (step.toolCalls.length > 0) {
      for (const tc of step.toolCalls) {
        console.log(`  Tool: ${tc.toolName}`);
      }
    }
    if (step.text) {
      console.log(`  Response: ${step.text.slice(0, 100)}...`);
    }
  }
  console.log("\nFinal:", result1.text);

  // Wait for memory indexing
  console.log("\n(waiting 2s for memory indexing...)");
  await new Promise((r) => setTimeout(r, 2000));

  // =========================================================================
  // Example 2: Multi-step tool use with goals
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Example 2: Multi-step goal management");
  console.log("-".repeat(50));

  const result2 = await generateText({
    model: google("gemini-2.5-flash"),
    tools,
    stopWhen: stepCountIs(10),
    system: `You are a helpful assistant with memory and goal tracking.`,
    prompt: `I need to complete a data analysis project. Please:
1. Create a high-priority goal for "Complete data analysis project"
2. Add sub-goals for "Clean the data" and "Build visualization dashboard"
3. List all goals to confirm they were created`,
  });

  console.log("\nSteps taken:", result2.steps.length);
  for (const step of result2.steps) {
    for (const tc of step.toolCalls) {
      console.log(`  Tool: ${tc.toolName}`);
    }
  }
  console.log("\nFinal:", result2.text);

  // =========================================================================
  // Example 3: Memory recall
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Example 3: Recall stored memories");
  console.log("-".repeat(50));

  const result3 = await generateText({
    model: google("gemini-2.5-flash"),
    tools,
    stopWhen: stepCountIs(5),
    system: `You are a helpful assistant with memory.`,
    prompt: `What do you remember about me? Use recall to search your memories.`,
  });

  console.log("\nSteps taken:", result3.steps.length);
  for (const step of result3.steps) {
    for (const tc of step.toolCalls) {
      console.log(`  Tool: ${tc.toolName}`);
    }
  }
  console.log("\nFinal:", result3.text);

  // =========================================================================
  // Example 4: Working memory variables
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Example 4: Working memory variables");
  console.log("-".repeat(50));

  const result4 = await generateText({
    model: google("gemini-2.5-flash"),
    tools,
    stopWhen: stepCountIs(10),
    system: `You are a helpful assistant that tracks conversation context.`,
    prompt: `Set up my user profile:
- Name: Sarah
- Occupation: Data Scientist
- Current project: NLP classification
Then list all variables to confirm.`,
  });

  console.log("\nSteps taken:", result4.steps.length);
  for (const step of result4.steps) {
    for (const tc of step.toolCalls) {
      console.log(`  Tool: ${tc.toolName}`);
    }
  }
  console.log("\nFinal:", result4.text);

  // =========================================================================
  // Cleanup
  // =========================================================================
  console.log("\n" + "=".repeat(50));
  console.log("All examples completed!");
}

main().catch(console.error);
