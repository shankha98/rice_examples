import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { CortexClient } from "../src/index";
import * as dotenv from "dotenv";
import { runChatLoop } from "./utils";

dotenv.config();

// Logging
function logger(name: string, message: string) {
  console.log(`${new Date().toISOString()} - ${name} - INFO - ${message}`);
}

// Slate Client
const slateAddress = process.env.SLATE_INSTANCE_URL || "localhost:50051";
const slateToken = process.env.SLATE_AUTH_TOKEN || "dev_secret";
const client = new CortexClient(slateAddress, slateToken);
logger("SlateAgent", `Connected to Slate Cortex at ${slateAddress}`);

// Tools Wrapper
const slateTools = {
  store_context: async (args: any) => {
    logger(
      "SlateAgent",
      `🛠️ TOOL CALLED: store_context | Args: ${JSON.stringify(args)}`
    );
    try {
      const resp = await client.focus(args.content);
      return `Stored context ID: ${resp}`;
    } catch (e) {
      console.error(`Failed to store context: ${e}`);
      return `Error: ${e}`;
    }
  },
  retrieve_context: async () => {
    logger("SlateAgent", `🛠️ TOOL CALLED: retrieve_context`);
    try {
      const items = await client.drift();
      if (!items || items.length === 0) return "Working memory is empty.";
      return [
        "Current Working Memory (Most Relevant First):",
        ...items.map(
          (item: any) =>
            `- ${item.content} (Score: ${item.relevance.toFixed(2)})`
        ),
      ].join("\n");
    } catch (e) {
      console.error(`Failed to retrieve context: ${e}`);
      return `Error: ${e}`;
    }
  },
  record_experience: async (args: any) => {
    logger(
      "SlateAgent",
      `🛠️ TOOL CALLED: record_experience | Args: ${JSON.stringify(args)}`
    );
    try {
      await client.commit(args.action, args.outcome, {
        action: args.action,
        reasoning: args.reasoning,
      });
      return "Experience committed to long-term memory.";
    } catch (e) {
      console.error(`Failed to record experience: ${e}`);
      return `Error: ${e}`;
    }
  },
  recall_experiences: async (args: any) => {
    logger(
      "SlateAgent",
      `🛠️ TOOL CALLED: recall_experiences | Args: ${JSON.stringify(args)}`
    );
    try {
      const traces = await client.reminisce(args.query, 3);
      if (!traces || traces.length === 0)
        return "No relevant past experiences found.";
      return [
        `Recall results for '${args.query}':`,
        ...traces.map(
          (t: any) =>
            `- Action: ${t.action} | Outcome: ${t.outcome} | Reasoning: ${t.reasoning}`
        ),
      ].join("\n");
    } catch (e) {
      console.error(`Failed to recall experiences: ${e}`);
      return `Error: ${e}`;
    }
  },
};

// Tool Definitions
const storeContextTool = {
  name: "store_context",
  description:
    "Stores temporary context or scratchpad notes in working memory.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { content: { type: SchemaType.STRING } },
    required: ["content"],
  },
};

const retrieveContextTool = {
  name: "retrieve_context",
  description:
    "Retrieves currently active context from working memory, sorted by relevance.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

const recordExperienceTool = {
  name: "record_experience",
  description:
    "Records an action and its outcome into long-term episodic memory.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      action: { type: SchemaType.STRING },
      outcome: { type: SchemaType.STRING },
      reasoning: { type: SchemaType.STRING },
    },
    required: ["action", "outcome"],
  },
};

const recallExperiencesTool = {
  name: "recall_experiences",
  description: "Searches long-term memory for similar past experiences.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { query: { type: SchemaType.STRING } },
    required: ["query"],
  },
};

async function createAgent(
  genAI: GoogleGenerativeAI,
  modelId: string,
  systemPrompt: string,
  toolDefs: any[],
  toolsMap: any
) {
  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: [{ functionDeclarations: toolDefs }] as any,
    systemInstruction: systemPrompt,
  });
  const chat = model.startChat();
  return { chat, toolsMap };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = "gemini-2.0-flash-exp";

  logger("SlateAgent", "--- Starting Complex Workflow: Software Dev Team ---");

  // 1. Architect Planning
  const architectPrompt =
    "You are a Software Architect. Your job is to design a scalable API for a 'Todo App'. " +
    "1. Outline the high-level architecture. " +
    "2. Store the key design decisions in working memory using 'store_context' so the developer can see them. " +
    "3. Check if we have built similar apps before using 'recall_experiences' to avoid pitfalls.";

  const architect = await createAgent(
    genAI,
    modelId,
    architectPrompt,
    [storeContextTool, recallExperiencesTool],
    {
      store_context: slateTools.store_context,
      recall_experiences: slateTools.recall_experiences,
    }
  );

  logger("SlateAgent", ">>> Architect is thinking...");
  const archResponse = await runChatLoop(
    architect.chat,
    "Please design the Todo App backend.",
    architect.toolsMap
  );
  console.log(`\n[Architect]: ${archResponse}\n`);

  // 2. Developer Implementation
  const developerPrompt =
    "You are a Senior Developer. " +
    "1. Retrieve the architecture plan from working memory ('retrieve_context'). " +
    "2. Based on the plan, propose the database schema (SQL). " +
    "3. Commit your implementation details to long-term memory ('record_experience') so QA knows what to test.";

  // Pause
  await new Promise((r) => setTimeout(r, 2000));

  const developer = await createAgent(
    genAI,
    modelId,
    developerPrompt,
    [retrieveContextTool, recordExperienceTool],
    {
      retrieve_context: slateTools.retrieve_context,
      record_experience: slateTools.record_experience,
    }
  );

  logger("SlateAgent", ">>> Developer is coding...");
  const devResponse = await runChatLoop(
    developer.chat,
    "Implement the database schema based on the architect's plan.",
    developer.toolsMap
  );
  console.log(`\n[Developer]: ${devResponse}\n`);

  // 3. QA Testing
  const qaPrompt =
    "You are a QA Engineer. " +
    "1. Retrieve the implementation details from long-term memory using 'recall_experiences' (search for 'schema' or 'database'). " +
    "2. Create a test plan. " +
    "3. Store the test plan in working memory ('store_context').";

  const qa = await createAgent(
    genAI,
    modelId,
    qaPrompt,
    [recallExperiencesTool, storeContextTool],
    {
      recall_experiences: slateTools.recall_experiences,
      store_context: slateTools.store_context,
    }
  );

  logger("SlateAgent", ">>> QA is testing...");
  const qaResponse = await runChatLoop(
    qa.chat,
    "Create a test plan for the database.",
    qa.toolsMap
  );
  console.log(`\n[QA]: ${qaResponse}\n`);
}

if (require.main === module) {
  main();
}
