import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { CortexClient } from "../src/index";
import * as dotenv from "dotenv";
import { runChatLoop } from "./utils";

dotenv.config();

// Slate Client
const slateAddress = process.env.SLATE_INSTANCE_URL || "localhost:50051";
const slateToken = process.env.SLATE_AUTH_TOKEN || "dev_secret";
const slate = new CortexClient(slateAddress, slateToken);

function logInternalAction(actionType: string, details: string) {
  console.log(`\n[INTERNAL ACTION] ${actionType}: ${details}`);
}

const toolsMap: any = {
  reasoning: async (args: any) => {
    logInternalAction(
      "Reasoning",
      `Processing context: ${args.context.substring(0, 50)}...`
    );
    try {
      const resp = await slate.focus(`[REASONING] ${args.context}`);
      return `Reasoning stored in Working Memory. ID: ${resp}`;
    } catch (e) {
      return `Error: ${e}`;
    }
  },
  retrieval: async (args: any) => {
    logInternalAction(
      "Retrieval",
      `Querying long-term memory for: ${args.query}`
    );
    try {
      const traces = await slate.reminisce(args.query, 3);
      if (!traces || traces.length === 0)
        return "No relevant long-term memories found.";

      const memories = traces
        .map((t: any) => `- ${t.input} -> ${t.outcome}`)
        .join("\n");

      // Store retrieved info into Working Memory
      await slate.focus(`[RETRIEVED] ${memories}`);
      return `Retrieved and stored in Working Memory:\n${memories}`;
    } catch (e) {
      return `Error: ${e}`;
    }
  },
  learning: async (args: any) => {
    logInternalAction(
      "Learning",
      `Committing experience: ${args.experience.substring(0, 50)}...`
    );
    try {
      await slate.commit(args.experience, args.outcome, {
        action: "Learning",
        reasoning: "Cognitive Update",
      });
      return "Experience learned (saved to Episodic Memory).";
    } catch (e) {
      return `Error: ${e}`;
    }
  },
  grounding_web_search: async (args: any) => {
    console.log(
      `\n[EXTERNAL ACTION] Grounding: Web Search for '${args.query}'`
    );
    return `Search Results for ${args.query}: [Simulated Result 1], [Simulated Result 2]`;
  },
};

const tools = [
  {
    functionDeclarations: [
      {
        name: "reasoning",
        description:
          "Internal Action: Reasoning. Updates working memory by processing current information.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { context: { type: SchemaType.STRING } },
          required: ["context"],
        },
      },
      {
        name: "retrieval",
        description:
          "Internal Action: Retrieval. Reads from long-term memory (Episodic/Semantic) into Working Memory.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { query: { type: SchemaType.STRING } },
          required: ["query"],
        },
      },
      {
        name: "learning",
        description:
          "Internal Action: Learning. Writes new experiences to long-term memory (Episodic).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            experience: { type: SchemaType.STRING },
            outcome: { type: SchemaType.STRING },
          },
          required: ["experience", "outcome"],
        },
      },
      {
        name: "grounding_web_search",
        description:
          "External Action: Grounding (Digital). Simulates a web search environment interaction.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { query: { type: SchemaType.STRING } },
          required: ["query"],
        },
      },
    ],
  },
];

async function runCognitiveAgent() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not set.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = "gemini-2.0-flash-exp";

  const systemPrompt =
    "You are a Cognitive Language Agent. Your architecture consists of:\n" +
    "1. Working Memory (Context)\n" +
    "2. Long-term Memory (Episodic/Semantic)\n" +
    "3. Action Space: Internal (Reasoning, Retrieval, Learning) and External (Grounding).\n\n" +
    "Your Decision Cycle:\n" +
    "1. PLAN: Use Retrieval and Reasoning to understand the situation.\n" +
    "2. ACT: Choose an External Action (Grounding) or Internal Action (Learning).\n" +
    "3. REFLECT: Update memory with the results.\n\n" +
    "Goal: Research 'Cognitive Architectures' and summarize key insights.";

  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: tools as any,
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat();

  console.log(`--- Starting Cognitive Agent (Model: ${modelId}) ---\n`);

  // Step 1: User Input
  const userInput = "Start research on Cognitive Architectures.";
  console.log(`User: ${userInput}`);

  const response1 = await runChatLoop(chat, userInput, toolsMap);
  console.log(`\nAgent: ${response1}`);

  // Step 2: Follow-up
  const nextStepPrompt =
    "Based on your previous actions, what is the next step in your decision cycle?";
  console.log(`\n[System Loop]: ${nextStepPrompt}`);

  const response2 = await runChatLoop(chat, nextStepPrompt, toolsMap);
  console.log(`\nAgent: ${response2}`);
}

if (require.main === module) {
  runCognitiveAgent();
}
