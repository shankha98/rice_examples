import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { Client, statetool } from "rice-node-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Cognitive Agent Example
 *
 * A complete AI agent using Google Gemini with Rice SDK memory tools.
 * The agent can:
 * - Store and recall information from long-term memory
 * - Manage working memory variables
 * - Track goals and progress
 * - Log reasoning and actions
 */

async function chat(
  ai: GoogleGenAI,
  client: Client,
  prompt: string,
  maxIterations = 3,
): Promise<string> {
  console.log(`\n[User] ${prompt}`);

  let contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];

  for (let i = 0; i < maxIterations; i++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: `You are a cognitive agent with persistent memory capabilities. 
          Use the provided tools to:
          - Store important information using 'remember' for long-term memory
          - Use 'focus' to add items to short-term working memory  
          - Use 'recall' to search your memories
          - Use 'setVariable'/'getVariable' for structured state
          - Use 'addGoal'/'updateGoal' to track objectives
          - Use 'submitAction' to log your reasoning process

          Be proactive about using memory tools to maintain context across conversations.`,
        tools: [{ functionDeclarations: statetool.google as any }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
      },
    });

    const calls = response.functionCalls;

    // If model made tool calls, execute them and continue
    if (calls && calls.length > 0) {
      console.log(`[Agent] Calling ${calls.length} tool(s)...`);

      // Add assistant response with function calls to history
      contents.push({
        role: "model",
        parts: calls.map((c) => ({
          functionCall: { name: c.name, args: c.args },
        })),
      });

      // Execute tools and collect results
      const functionResponses: any[] = [];
      for (const call of calls) {
        if (!call.name) continue;

        console.log(`        -> ${call.name}(${JSON.stringify(call.args)})`);

        try {
          const result = await statetool.execute(
            call.name,
            call.args || {},
            client.state,
          );
          console.log(
            `        <- ${JSON.stringify(result).slice(0, 100)}${JSON.stringify(result).length > 100 ? "..." : ""}`,
          );
          functionResponses.push({
            functionResponse: { name: call.name, response: { result } },
          });
        } catch (e: any) {
          console.log(`        <- Error: ${e.message}`);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: e.message },
            },
          });
        }
      }

      // Add function responses to history
      contents.push({ role: "user", parts: functionResponses });
      continue;
    }

    // No tool calls - return text response
    const text = response.text || "(no response)";
    console.log(`[Agent] ${text}`);
    return text;
  }

  return "(max iterations reached)";
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error(
      "Error: GEMINI_API_KEY not set. Create .env file with your API key.",
    );
    console.error("Get one at: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  console.log("Cognitive Agent with Google Gemini + Rice Memory");
  console.log("=".repeat(50));

  // Initialize Rice client
  const client = new Client({
    runId: `agent-${Date.now()}`,
    configPath: path.resolve(__dirname, "../rice.config.js"),
  });

  await client.connect();
  console.log("Connected to Rice State service");
  console.log(`Available tools: ${statetool.google.length}`);

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // =========================================================================
  // Conversation 1: Establish context and remember preferences
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Phase 1: Learning about the user");
  console.log("-".repeat(50));

  await chat(
    ai,
    client,
    "Hi! I'm Alex, a software engineer working on a machine learning project. " +
      "I prefer Python for ML work but use TypeScript for web apps. " +
      "Please remember these details about me.",
  );

  // =========================================================================
  // Conversation 2: Set up goals
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Phase 2: Planning with goals");
  console.log("-".repeat(50));

  await chat(
    ai,
    client,
    "I need to build a recommendation system. Can you help me plan this? " +
      "Create goals for: 1) Data collection, 2) Model training, 3) API deployment.",
  );

  // =========================================================================
  // Conversation 3: Working memory for current context
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Phase 3: Managing working memory");
  console.log("-".repeat(50));

  await chat(
    ai,
    client,
    "Set my current_task to 'designing the data pipeline' and my deadline to 'February 1, 2026'. " +
      "Then tell me what you have stored.",
  );

  // Wait for memory indexing
  console.log("\n(waiting 2s for memory indexing...)");
  await new Promise((r) => setTimeout(r, 2000));

  // =========================================================================
  // Conversation 4: Recall and reason
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Phase 4: Recall and reasoning");
  console.log("-".repeat(50));

  await chat(
    ai,
    client,
    "What do you remember about me and my project? " +
      "Search your memory and give me a summary.",
  );

  // =========================================================================
  // Conversation 5: Complex multi-tool interaction
  // =========================================================================
  console.log("\n" + "-".repeat(50));
  console.log("Phase 5: Complex reasoning");
  console.log("-".repeat(50));

  await chat(
    ai,
    client,
    "I just finished the data collection phase. Please: " +
      "1) Update that goal as achieved, " +
      "2) Log a reasoning action about our progress, " +
      "3) Tell me what's next based on our goals.",
  );

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n" + "=".repeat(50));
  console.log("Session complete!");
  console.log("=".repeat(50));

  // Show final state
  const vars = await client.state.listVariables();
  const goals = await client.state.listGoals();

  console.log(`\nFinal state:`);
  console.log(`  Variables: ${vars.length}`);
  console.log(`  Goals: ${goals.length}`);

  // Cleanup
  try {
    await client.state.deleteRun();
    console.log(`  Cleaned up run data`);
  } catch (e) {
    // Server limitation
  }
}

main().catch(console.error);
