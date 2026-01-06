import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { CortexClient } from "../src/index";
import * as dotenv from "dotenv";
import { runChatLoop } from "./utils";

dotenv.config();

// Initialize Slate Client
const slateAddress = process.env.SLATE_INSTANCE_URL || "localhost:50051";
const slateToken = process.env.SLATE_AUTH_TOKEN || "dev_secret";
const slate = new CortexClient(slateAddress, slateToken);

// Define Tools
const toolsMap: any = {
  remember: async (args: any) => {
    try {
      const id = await slate.focus(args.content);
      return `Stored in working memory. ID: ${id}`;
    } catch (e) {
      return `Error storing memory: ${e}`;
    }
  },
  recall_context: async () => {
    try {
      const items = await slate.drift();
      if (!items || items.length === 0) return "Working memory is empty.";
      return items
        .map(
          (item: any) =>
            `- ${item.content} (Relevance: ${item.relevance.toFixed(2)})`
        )
        .join("\n");
    } catch (e) {
      return `Error retrieving memory: ${e}`;
    }
  },
  save_experience: async (args: any) => {
    try {
      await slate.commit(args.input_text, args.outcome, {
        action: args.action,
      });
      return "Experience saved to long-term memory.";
    } catch (e) {
      return `Error saving experience: ${e}`;
    }
  },
  recall_past: async (args: any) => {
    try {
      const traces = await slate.reminisce(args.query, 3);
      if (!traces || traces.length === 0)
        return "No relevant past experiences found.";
      return traces
        .map((t: any) => `- Input: ${t.input} -> Outcome: ${t.outcome}`)
        .join("\n");
    } catch (e) {
      return `Error searching memory: ${e}`;
    }
  },
};

const tools = [
  {
    functionDeclarations: [
      {
        name: "remember",
        description: "Stores a piece of information in working memory.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            content: { type: SchemaType.STRING },
          },
          required: ["content"],
        },
      },
      {
        name: "recall_context",
        description: "Retrieves current working memory context.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "save_experience",
        description:
          "Saves an interaction experience to long-term episodic memory.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            input_text: { type: SchemaType.STRING },
            action: { type: SchemaType.STRING },
            outcome: { type: SchemaType.STRING },
          },
          required: ["input_text", "action", "outcome"],
        },
      },
      {
        name: "recall_past",
        description:
          "Searches long-term episodic memory for similar past experiences.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING },
          },
          required: ["query"],
        },
      },
    ],
  },
];

async function runAgent() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY environment variable not set.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = "gemini-2.0-flash-exp";
  console.log(`Agent starting with model ${modelId}...`);

  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: tools as any,
    systemInstruction:
      "You are an intelligent agent with access to external memory tools (Slate). Use 'remember' to store temporary context. Use 'recall_context' to see what you are working on. Use 'save_experience' to log important actions. Use 'recall_past' to learn from history. Always check your memory before acting.",
  });

  const chat = model.startChat();

  async function sendMessage(msg: string) {
    console.log(`User: ${msg}`);
    const responseText = await runChatLoop(chat, msg, toolsMap);
    console.log(`Agent: ${responseText}`);
  }

  console.log("\n--- Interaction 1: Context Setting ---");
  await sendMessage("I am planning a surprise party for Alice next Friday.");

  console.log("\n--- Interaction 2: Recall ---");
  await sendMessage("Who is the party for and when?");
}

if (require.main === module) {
  runAgent();
}
