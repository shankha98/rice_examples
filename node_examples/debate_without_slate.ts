import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

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

// --- Tools (No Slate, just returning strings) ---

async function searchMarketData(query: string): Promise<string> {
  // console.log(`  [Tool] Searching market data for: ${query}`);
  return "Market Size: EU AI market projected to reach €50B by 2030. Competitors: Mistral, SAP, Siemens.";
}

async function searchRegulations(query: string): Promise<string> {
  // console.log(`  [Tool] Searching regulations for: ${query}`);
  return "EU AI Act: High-risk systems require conformity assessments. GDPR: Strict data sovereignty rules.";
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
  topic: string,
  context: string[]
): Promise<[number, string]> {
  // Simulate context passing
  const fullContextStr = context.join("\n");

  const systemInstruction = `You are ${name}. ${rolePrompt}
1. Read the provided context to see what others have said.
2. Use 'searchMarketData' or 'searchRegulations' if you need external facts.
3. Formulate your argument/critique/finding.
4. Output your contribution clearly.`;

  const chat = model.startChat({
    tools: [
      {
        functionDeclarations: [
          {
            name: "searchMarketData",
            description: "Simulates searching for market data.",
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
          {
            name: "searchRegulations",
            description: "Simulates searching for regulatory data.",
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

  const userMsg = `Topic: ${topic}. Current Round: ${roundId}. Context:\n${fullContextStr}\n\nPlease contribute.`;

  let result = await chat.sendMessage(userMsg);
  let response = result.response;

  // Handle function calls
  while (response.functionCalls()) {
    const calls = response.functionCalls();
    const parts: any[] = [];

    if (calls) {
      for (const call of calls) {
        let functionResponse;
        if (call.name === "searchMarketData") {
          functionResponse = await searchMarketData(call.args.query as string);
        } else if (call.name === "searchRegulations") {
          functionResponse = await searchRegulations(call.args.query as string);
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

  const outputText = `[${name} | Round ${roundId}]: ${response.text()}`;
  console.log(`  [Context] ${name} output received.`);

  const usage = response.usageMetadata;
  const tokens = usage ? usage.totalTokenCount : 0;
  return [tokens, outputText];
}

async function runSynthesizer(
  topic: string,
  context: string[]
): Promise<number> {
  console.log(`\n--- SYNTHESIZER AGENT: Final Brief ---`);

  const fullContextStr = context.join("\n");

  const systemInstruction = `You are the Chief Synthesizer. Read the entire debate context. 
    Produce a comprehensive executive brief that weighs all perspectives (Market, Tech, Legal, Financial, Ethical). 
    Provide a final Go/No-Go recommendation.`;

  const chat = model.startChat({
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
  });

  const userMsg = `Generate the final brief for: ${topic}\nContext:\n${fullContextStr}`;
  let result = await chat.sendMessage(userMsg);
  let response = result.response;

  console.log(`\n=== FINAL BRIEF ===\n${response.text()}\n===================`);
  const usage = response.usageMetadata;
  return usage ? usage.totalTokenCount : 0;
}

// --- Main Demo ---

async function main() {
  const topic =
    "Expand portfolio company into EU market given new AI regulations";
  console.log(`Objective: ${topic}\n`);
  console.log(
    "[Setup] Parallel execution with 5 specialized agents over 3 rounds."
  );

  const startTime = Date.now();
  let totalTokens = 0;
  const rounds = 3;
  let context: string[] = []; // Growing list of strings

  for (let r = 1; r <= rounds; r++) {
    console.log(`\n--- ROUND ${r} START ---`);

    // We pass a copy of current context to all agents (Parallel Independent Execution simulation)
    const currentContextSnapshot = [...context];

    const promises = Object.entries(AGENTS).map(([name, role]) =>
      runAgent(name, role, r, topic, currentContextSnapshot)
    );
    const results = await Promise.all(promises);

    for (const [tokens, output] of results) {
      totalTokens += tokens;
      context.push(output);
    }

    console.log(
      `--- ROUND ${r} COMPLETE (Context size: ${context.length} items) ---`
    );
  }

  const synthTokens = await runSynthesizer(topic, context);
  totalTokens += synthTokens;

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n[Metrics] Workflow completed in ${duration.toFixed(2)}s`);
  console.log(`[Metrics] Total Token Usage (Without Slate): ${totalTokens}`);
}

main().catch(console.error);
