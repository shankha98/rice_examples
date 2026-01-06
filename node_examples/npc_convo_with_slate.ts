import { CortexClient } from "slate-client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";
import { generateGameplayLogs } from "./game_data_generator";

// Load environment variables
const envPath = path.resolve(__dirname, "../clients/python/.env");
dotenv.config({ path: envPath });

const SLATE_URL = process.env.SLATE_INSTANCE_URL || "localhost:50051";
const SLATE_TOKEN = process.env.SLATE_AUTH_TOKEN || "dev_secret";
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("Error: GEMINI_API_KEY not set.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

console.log(`Connecting to Slate at ${SLATE_URL}...`);
const slate = new CortexClient(SLATE_URL, SLATE_TOKEN);

// --- Tools ---

async function recallRelevantMemories(query: string): Promise<string> {
  console.log(`  [Slate] Semantic search for: '${query}'`);
  try {
    const resp = await slate.reminisce(query, 3);
    if (!resp.traces || resp.traces.length === 0) {
      console.log("  [Slate] No relevant memories found.");
      return "No relevant memories found.";
    }

    const results = resp.traces.map((t: any) => `- ${t.input}`);
    const resultStr = results.join("\n");
    console.log(`  [Slate] Retrieved:\n${resultStr}`);
    return resultStr;
  } catch (e) {
    console.log(`  [Slate] Error: ${e}`);
    return `Error searching history: ${e}`;
  }
}

// --- Agent ---

async function generateNpcDialogue(
  npcName: string,
  playerContext: string
): Promise<number> {
  console.log(`\n--- Generative NPC: ${npcName} ---`);

  const systemInstruction = `You are ${npcName}, an NPC in an open world RPG. 
    Generate a single dialogue line to greet the player. 
    1. Use 'recallRelevantMemories' to check what the player has done related to you or your quests. 
    2. If they completed your quest, thank them. 
    3. If they found the item but sold it, be angry. 
    4. If they haven't started, offer the quest. 
    5. Be immersive.`;

  const chat = model.startChat({
    tools: [
      {
        functionDeclarations: [
          {
            name: "recallRelevantMemories",
            description: "Searches gameplay history for relevant events.",
            parameters: {
              type: "OBJECT",
              properties: {
                query: {
                  type: "STRING",
                  description: "The query to search for.",
                },
              },
              required: ["query"],
            },
          },
        ],
      },
    ],
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
  });

  const userMsg = `Player approaches you. ${playerContext}`;

  const startTime = Date.now();
  let result = await chat.sendMessage(userMsg);
  let response = result.response;

  while (response.functionCalls()) {
    const calls = response.functionCalls();
    const parts: any[] = [];
    if (calls) {
      for (const call of calls) {
        let functionResponse;
        if (call.name === "recallRelevantMemories") {
          functionResponse = await recallRelevantMemories(
            call.args.query as string
          );
        }
        parts.push({
          functionResponse: {
            name: call.name,
            response: { name: call.name, content: functionResponse },
          },
        });
      }
    }
    result = await chat.sendMessage(parts);
    response = result.response;
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`${npcName}: ${response.text()}`);
  console.log(`[Metrics] Response generated in ${duration.toFixed(2)}s`);

  const usage = response.usageMetadata;
  console.log(`[Metrics] Token Usage: ${usage ? usage.totalTokenCount : 0}`);
  return duration;
}

// --- Main Flow ---

async function main() {
  console.log("Generating Gameplay Data...");
  const logs = generateGameplayLogs(1000); // 1000 entries
  console.log(`Generated ${logs.length} log entries.`);

  console.log("\n[Phase 1] Ingesting into Slate (Simulating Gameplay)...");
  const ingestStart = Date.now();

  // Ingesting
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    try {
      // Use focus to ensure it's in Working Memory (Drift) accessible by this token
      await slate.focus(log);
      // Also commit for persistence
      await slate.commit(log, "Game Event", "Gameplay", "Log");

      if (i % 10 === 0) {
        process.stdout.write(`  Processed ${i}/${logs.length} logs...\r`);
      }
    } catch (e) {
      console.error(`Error processing: ${e}`);
    }
  }

  const ingestDuration = (Date.now() - ingestStart) / 1000;
  console.log(`\nIngestion complete in ${ingestDuration.toFixed(2)}s`);
  console.log("Waiting for indexing (10s)...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log("\n[Phase 2] Interaction");
  // Scenario: Player talks to Blacksmith Gorn

  await generateNpcDialogue("Blacksmith Gorn", "Player stands before you.");
}

main().catch(console.error);
