import { CortexClient } from "slate-client";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

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

async function searchMarketData(query: string): Promise<string> {
  // console.log(`  [Tool] Searching market data for: ${query}`);
  return "Market Size: EU AI market projected to reach €50B by 2030. Competitors: Mistral, SAP, Siemens.";
}

async function searchRegulations(query: string): Promise<string> {
  // console.log(`  [Tool] Searching regulations for: ${query}`);
  return "EU AI Act: High-risk systems require conformity assessments. GDPR: Strict data sovereignty rules.";
}

async function storeFinding(content: string, source: string): Promise<string> {
  console.log(
    `  [Slate] Storing finding from ${source}: ${content.substring(0, 50)}...`
  );
  try {
    await slate.focus(`[${source}] ${content}`);
    await slate.commit(content, "Stored", {
      action: "Research",
      reasoning: `Finding from ${source}`,
    });
    return "Finding stored in shared state.";
  } catch (e) {
    return `Error storing: ${e}`;
  }
}

async function readSharedState(): Promise<string> {
  // console.log("  [Slate] Reading shared state...");
  try {
    const resp = await slate.drift();
    if (!resp || resp.length === 0) {
      return "Shared state is empty.";
    }
    return (resp as any[]).map((item: any) => `- ${item.content}`).join("\n");
  } catch (e) {
    return `Error reading state: ${e}`;
  }
}

async function searchDebateHistory(query: string): Promise<string> {
  console.log(`  [Slate] Semantic search for: ${query}`);
  try {
    const resp = await slate.reminisce(query, 5);
    if (!resp || resp.length === 0) {
      return "No relevant arguments found.";
    }
    return (resp as any[])
      .map((t: any) => `[${t.action}] ${t.input} -> ${t.outcome}`)
      .join("\n");
  } catch (e) {
    return `Error searching history: ${e}`;
  }
}

async function readRecentState(): Promise<string> {
  try {
    const resp = await slate.drift();
    if (!resp || resp.length === 0) return "Shared state is empty.";
    // Only take last 5 items
    return (resp as any[])
      .slice(-5)
      .map((item: any) => `[${item.id}] ${item.content}`)
      .join("\n");
  } catch (e) {
    return `Error reading state: ${e}`;
  }
}

async function logCritique(critique: string): Promise<string> {
  console.log(`  [Slate] Logging critique: ${critique.substring(0, 50)}...`);
  try {
    await slate.focus(`[CRITIC] ${critique}`);
    await slate.commit(critique, "Critique", {
      action: "Critique",
      reasoning: "Challenging assumption",
    });
    return "Critique logged.";
  } catch (e) {
    return `Error logging: ${e}`;
  }
}

async function contributeToDebate(
  agentName: string,
  content: string,
  roundId: number
): Promise<string> {
  const header = `[${agentName} | Round ${roundId}]`;
  console.log(`  [Slate] ${header} contributing...`);
  try {
    await slate.focus(`${header} ${content}`);
    await slate.commit(content, "Debate Contribution", {
      action: agentName,
      reasoning: `Round ${roundId}`,
    });
    return "Contribution logged.";
  } catch (e) {
    return `Error logging: ${e}`;
  }
}

// --- Agent Factory ---

const AGENTS = {
  MarketAnalyst:
    "Analyze market size, growth, competitors, and strategic opportunities.",
  TechAdvisor:
    "Analyze technical feasibility, architecture, compliance with standards, and implementation risks.",
  LegalAdvisor:
    "Analyze regulatory compliance (EU AI Act, GDPR), legal risks, and liability.",
  FinancialAnalyst:
    "Analyze costs, ROI, budget implications, and financial risks.",
  Ethicist:
    "Analyze societal impact, bias, fairness, and ethical implications of the expansion.",
};

async function runAgent(
  name: string,
  rolePrompt: string,
  roundId: number,
  topic: string
): Promise<number> {
  const systemInstruction = `You are ${name}. ${rolePrompt}
1. Use 'readRecentState' to see the latest contributions.
2. Use 'searchDebateHistory' to find specific arguments relevant to your domain.
3. Use 'searchMarketData' or 'searchRegulations' if you need external facts.
4. Formulate your argument/critique/finding.
5. Contribute to the debate using 'contributeToDebate'.`;

  const chat = model.startChat({
    tools: [
      {
        functionDeclarations: [
          {
            name: "readRecentState",
            description: "Reads the most recent items from working memory.",
          },
          {
            name: "searchDebateHistory",
            description: "Searches the debate history for relevant arguments.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: {
                  type: SchemaType.STRING,
                  description: "The query to search for.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "searchMarketData",
            description: "Simulates searching for market data.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: {
                  type: SchemaType.STRING,
                  description: "The query to search for.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "searchRegulations",
            description: "Simulates searching for regulatory data.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: {
                  type: SchemaType.STRING,
                  description: "The query to search for.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "contributeToDebate",
            description: "Writes a contribution to the shared debate state.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                agentName: {
                  type: SchemaType.STRING,
                  description: "The name of the agent.",
                },
                content: {
                  type: SchemaType.STRING,
                  description: "The content of the contribution.",
                },
                roundId: {
                  type: SchemaType.NUMBER,
                  description: "The current round ID.",
                },
              },
              required: ["agentName", "content", "roundId"],
            },
          },
        ],
      },
    ],
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
  });

  const userMsg = `Topic: ${topic}. Current Round: ${roundId}. Please contribute.`;

  // Node.js client tool calling loop is manual or requires a helper.
  // For simplicity in this example, we'll implement a basic loop.
  let currentMsg = userMsg;

  // Initial message
  let result = await chat.sendMessage(currentMsg);
  let response = result.response;

  // Handle function calls
  while (response.functionCalls()) {
    const calls = response.functionCalls();
    const parts: any[] = [];

    if (calls) {
      for (const call of calls) {
        const args: any = call.args;
        let functionResponse;
        if (call.name === "readRecentState") {
          functionResponse = await readRecentState();
        } else if (call.name === "searchDebateHistory") {
          functionResponse = await searchDebateHistory(args.query as string);
        } else if (call.name === "searchMarketData") {
          functionResponse = await searchMarketData(args.query as string);
        } else if (call.name === "searchRegulations") {
          functionResponse = await searchRegulations(args.query as string);
        } else if (call.name === "contributeToDebate") {
          functionResponse = await contributeToDebate(
            args.agentName as string,
            args.content as string,
            args.roundId as number
          );
        } else {
          functionResponse = "Unknown tool";
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

  // Count tokens (approximate for this example flow as we don't sum up intermediate)
  const usage = response.usageMetadata;
  return usage ? usage.totalTokenCount : 0;
}

async function runSynthesizer(topic: string): Promise<number> {
  console.log(`\n--- SYNTHESIZER AGENT: Final Brief ---`);

  const systemInstruction = `You are the Chief Synthesizer. Use 'searchDebateHistory' to gather key arguments from all perspectives. 
    Produce a comprehensive executive brief that weighs all perspectives (Market, Tech, Legal, Financial, Ethical). 
    Provide a final Go/No-Go recommendation.`;

  const chat = model.startChat({
    tools: [
      {
        functionDeclarations: [
          {
            name: "searchDebateHistory",
            description: "Searches the debate history for relevant arguments.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: {
                  type: SchemaType.STRING,
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

  const userMsg = `Generate the final brief for: ${topic}`;
  let result = await chat.sendMessage(userMsg);
  let response = result.response;

  while (response.functionCalls()) {
    const calls = response.functionCalls();
    const parts: any[] = [];
    if (calls) {
      for (const call of calls) {
        const args: any = call.args;
        let functionResponse;
        if (call.name === "searchDebateHistory") {
          functionResponse = await searchDebateHistory(args.query as string);
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

  console.log(`\n=== FINAL BRIEF ===\n${response.text()}\n===================`);
  const usage = response.usageMetadata;
  return usage ? usage.totalTokenCount : 0;
}

// --- Main Demo ---

async function main() {
  const topic =
    "Expand portfolio company into EU market given new AI regulations";
  console.log(`Objective: ${topic}\n`);

  const startTime = Date.now();
  let totalTokens = 0;
  const rounds = 3;

  // We run rounds sequentially here because Node.js is single-threaded and `slate` client might not handle concurrent requests perfectly if not designed for it,
  // but logically we can simulate parallel agents by running them one after another in the same round loop.
  // Or we can use Promise.all to run them concurrently. Let's try Promise.all.

  for (let r = 1; r <= rounds; r++) {
    console.log(`\n--- ROUND ${r} START ---`);
    const promises = Object.entries(AGENTS).map(([name, role]) =>
      runAgent(name, role, r, topic)
    );
    const results = await Promise.all(promises);
    results.forEach((tokens) => (totalTokens += tokens));
    console.log(`--- ROUND ${r} COMPLETE ---`);
  }

  const synthTokens = await runSynthesizer(topic);
  totalTokens += synthTokens;

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n[Metrics] Workflow completed in ${duration.toFixed(2)}s`);
  console.log(`[Metrics] Total Token Usage (With Slate): ${totalTokens}`);
  console.log("[Observability] Check Slate Dashboard for full decision trace.");
}

main().catch(console.error);
