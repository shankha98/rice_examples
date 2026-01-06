import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { CortexClient } from "../src/index";
import * as dotenv from "dotenv";
import { runChatLoop } from "./utils";

dotenv.config();

// Shared Memory
const slateAddress = process.env.SLATE_INSTANCE_URL || "localhost:50051";
const slateToken = process.env.SLATE_AUTH_TOKEN || "dev_secret";
console.log(
  `Connecting to Slate at ${slateAddress} with token: ${slateToken.substring(
    0,
    5
  )}...`
);

const slate = new CortexClient(slateAddress, slateToken);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable not set.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const modelId = "gemini-2.0-flash-exp";

// --- Researcher Agent ---
const researcherToolsMap: any = {
  search: async (args: any) => {
    const query = args.query.toLowerCase();
    console.log(`[Tool] Searching for: ${query}`);
    if (query.includes("rust")) {
      return (
        "Rust was born at Mozilla Research. Graydon Hoare started it in 2006. " +
        "Version 1.0 was released in 2015. " +
        "It introduced the concept of ownership and borrowing for memory safety without garbage collection. " +
        "The Rust Foundation was formed in 2021."
      );
    }
    return "No results found.";
  },
  store_finding: async (args: any) => {
    const fact = args.fact;
    console.log(`[Tool] Storing finding: ${fact}`);
    try {
      await slate.focus(`[FINDING] ${fact}`);
      await slate.commit(fact, "Research Finding", {
        action: "Research",
        reasoning: "Important fact found",
      });
      return "Finding stored.";
    } catch (e) {
      console.log(`[Tool Error] store_finding failed: ${e}`);
      return `Error: ${e}`;
    }
  },
};

const researcherTools = [
  {
    functionDeclarations: [
      {
        name: "search",
        description:
          "Simulates a web search engine. Use this to find information.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING },
          },
          required: ["query"],
        },
      },
      {
        name: "store_finding",
        description: "Stores a research finding in shared working memory.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fact: { type: SchemaType.STRING },
          },
          required: ["fact"],
        },
      },
    ],
  },
];

async function researcherTask(topic: string) {
  console.log(`\n--- Researcher working on: ${topic} ---`);
  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: researcherTools as any,
    systemInstruction:
      "You are a Researcher. Your goal is to find interesting facts about the topic " +
      "and store them using 'store_finding'. Use the 'search' tool to find information. " +
      "You do not write the final report. Just find 2-3 distinct facts and store them.",
  });

  const chat = model.startChat();
  const response = await runChatLoop(
    chat,
    `Research this topic: ${topic}`,
    researcherToolsMap
  );
  console.log(`Researcher: ${response}`);
}

// --- Writer Agent ---
const writerToolsMap: any = {
  read_memory: async () => {
    console.log("[Tool] Reading memory...");
    try {
      const items = await slate.drift();
      const findings = items
        .filter((item: any) => item.content.includes("[FINDING]"))
        .map((item: any) => item.content);
      if (!findings || findings.length === 0) {
        console.log("[Tool] No findings found in memory.");
        return "No findings yet.";
      }
      return findings.join("\n");
    } catch (e) {
      console.log(`[Tool Error] read_memory failed: ${e}`);
      return `Error: ${e}`;
    }
  },
};

const writerTools = [
  {
    functionDeclarations: [
      {
        name: "read_memory",
        description: "Reads all findings from working memory.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
    ],
  },
];

async function writerTask(topic: string) {
  console.log(`\n--- Writer working on: ${topic} ---`);
  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: writerTools as any,
    systemInstruction:
      "You are a Writer. Your goal is to write a short summary based ONLY on findings " +
      "available in memory. Use 'read_memory' to get facts. " +
      "Do not hallucinate facts not in memory.",
  });

  const chat = model.startChat();
  const response = await runChatLoop(
    chat,
    `Write a report on: ${topic}`,
    writerToolsMap
  );
  console.log(`Writer: ${response}`);
}

async function main() {
  const topic = "The history of Rust programming language";

  await researcherTask(topic);
  await writerTask(topic);
}

if (require.main === module) {
  main();
}
