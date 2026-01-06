import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";
import { generateGameplayLogs } from "./game_data_generator";

// Load environment variables
const envPath = path.resolve(__dirname, "../clients/python/.env");
dotenv.config({ path: envPath });

const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("Error: GEMINI_API_KEY not set.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// --- Agent ---

async function generateNpcDialogue(
  npcName: string,
  playerContext: string,
  historyLogs: string[]
): Promise<number> {
  console.log(`\n--- Generative NPC (No Slate): ${npcName} ---`);

  // Flatten history into a massive string
  const fullHistory = historyLogs.join("\n");

  const systemInstruction = `You are ${npcName}, an NPC in an open world RPG. 
    Generate a single dialogue line to greet the player. 
    You have access to the ENTIRE gameplay history below. 
    1. Check if the player completed your quest. 
    2. If they completed your quest, thank them. 
    3. If they found the item but sold it, be angry. 
    4. If they haven't started, offer the quest. 
    5. Be immersive.`;

  const chat = model.startChat({
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
  });

  // We pass the full history in the prompt (Simulating standard Context Window approach)
  const prompt =
    `GAMEPLAY HISTORY:\n${fullHistory}\n\n` +
    `CURRENT SITUATION: Player approaches you. ${playerContext}\n` +
    `Respond as ${npcName}:`;

  const startTime = Date.now();
  const result = await chat.sendMessage(prompt);
  const response = result.response;
  const duration = (Date.now() - startTime) / 1000;

  console.log(`${npcName}: ${response.text()}`);
  console.log(
    `[Metrics] Response generated in ${duration.toFixed(
      2
    )}s (High Latency due to context processing)`
  );

  const usage = response.usageMetadata;
  console.log(
    `[Metrics] Token Usage: ${usage ? usage.totalTokenCount : 0} (High Cost)`
  );
  return duration;
}

// --- Main Flow ---

async function main() {
  console.log("Generating Gameplay Data (Large History)...");
  const logs = generateGameplayLogs(1000);
  console.log(`Generated ${logs.length} log entries.`);

  const estimatedTokens = Math.floor(logs.join("\n").length / 4);
  console.log(`Estimated History Context: ~${estimatedTokens} tokens`);

  console.log("\n[Phase 2] Interaction");
  // Scenario: Player talks to Blacksmith Gorn

  await generateNpcDialogue(
    "Blacksmith Gorn",
    "Player stands before you.",
    logs
  );
}

main().catch(console.error);
