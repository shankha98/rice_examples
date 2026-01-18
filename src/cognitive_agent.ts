import { Client } from "rice-node-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Cognitive Agent Example
 *
 * This example demonstrates how to build a goal-directed cognitive agent
 * using the State service's advanced features:
 *
 * 1. Working Memory - Structured variables for agent state
 * 2. Goals - Hierarchical goal management
 * 3. Actions - Action logging and execution
 * 4. Decision Cycles - Autonomous decision-making with candidates
 * 5. Concepts - Schema definitions for structured knowledge
 */

interface AgentConfig {
  id: string;
  name: string;
  description: string;
}

class CognitiveAgent {
  private client: Client;
  private config: AgentConfig;
  private cycleCount: number = 0;

  constructor(client: Client, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Initialize the agent's working memory and concepts
   */
  async initialize(): Promise<void> {
    console.log(`\n[${this.config.name}] Initializing...`);

    // Set up initial working memory state
    await this.client.state.setVariable("agent_id", this.config.id, "system");
    await this.client.state.setVariable(
      "agent_name",
      this.config.name,
      "system",
    );
    await this.client.state.setVariable("agent_status", "active", "system");
    await this.client.state.setVariable("cycle_count", 0, "system");
    await this.client.state.setVariable(
      "context",
      {
        initialized_at: new Date().toISOString(),
        description: this.config.description,
      },
      "system",
    );

    // Define concepts (schemas) the agent understands
    await this.client.state.defineConcept("Observation", {
      type: "object",
      properties: {
        content: { type: "string" },
        source: { type: "string" },
        timestamp: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["content", "source"],
    });

    await this.client.state.defineConcept("Plan", {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        steps: { type: "array", items: { type: "string" } },
        estimated_cycles: { type: "number" },
        status: {
          type: "string",
          enum: ["pending", "executing", "completed", "failed"],
        },
      },
      required: ["goal_id", "steps"],
    });

    console.log(`[${this.config.name}] Initialization complete.`);
  }

  /**
   * Add a goal to the agent's goal stack
   */
  async addGoal(
    description: string,
    priority: "low" | "medium" | "high" | "critical" = "medium",
    parentId?: string,
  ): Promise<any> {
    console.log(
      `\n[${this.config.name}] Adding goal: "${description}" (${priority})`,
    );

    const goal = await this.client.state.addGoal(
      description,
      priority,
      parentId,
    );

    // Log the action
    await this.client.state.submitAction(this.config.id, "reason", {
      thought: `Added new ${priority} priority goal`,
      goal_description: description,
      goal_id: goal.id,
    });

    return goal;
  }

  /**
   * Process an observation and store it in memory
   */
  async observe(
    content: string,
    source: string,
    confidence: number = 1.0,
  ): Promise<void> {
    console.log(
      `\n[${this.config.name}] Observing: "${content}" from ${source}`,
    );

    // Store in episodic memory
    await this.client.state.commit(content, `Observation from ${source}`, {
      action: "observe",
      agent_id: this.config.id,
      reasoning: `Confidence: ${confidence}`,
    });

    // Update working memory
    await this.client.state.setVariable(
      "last_observation",
      {
        content,
        source,
        timestamp: new Date().toISOString(),
        confidence,
      },
      "perception",
    );

    // Log the action
    await this.client.state.submitAction(this.config.id, "learn", {
      observation: content,
      source,
      confidence,
    });
  }

  /**
   * Recall relevant memories based on a query
   */
  async recall(query: string, limit: number = 5): Promise<any[]> {
    console.log(`\n[${this.config.name}] Recalling: "${query}"`);

    const memories = await this.client.state.reminisce(query, limit);

    // Log the retrieval action
    await this.client.state.submitAction(this.config.id, "retrieve", {
      query,
      limit,
      results_count: memories.length,
    });

    return memories;
  }

  /**
   * Run a decision cycle with candidate actions
   */
  async runDecisionCycle(
    candidates: Array<{
      actionType: string;
      action: any;
      score: number;
      rationale: string;
    }>,
  ): Promise<any> {
    this.cycleCount++;
    console.log(
      `\n[${this.config.name}] Running decision cycle #${this.cycleCount}`,
    );
    console.log(`  Candidates: ${candidates.length}`);
    candidates.forEach((c, i) => {
      console.log(
        `    ${i + 1}. [${c.actionType}] score=${c.score.toFixed(2)} - ${c.rationale}`,
      );
    });

    // Update cycle count in working memory
    await this.client.state.setVariable(
      "cycle_count",
      this.cycleCount,
      "system",
    );

    // Run the decision cycle
    const result = await this.client.state.runCycle(this.config.id, candidates);

    console.log(`  Selected: ${result.selectedAction?.action_type || "none"}`);
    console.log(`  Planning time: ${result.planningTimeMs}ms`);
    console.log(`  Execution time: ${result.executionTimeMs}ms`);

    return result;
  }

  /**
   * Execute a reasoning step
   */
  async reason(thought: string, conclusion: string): Promise<any> {
    console.log(`\n[${this.config.name}] Reasoning...`);
    console.log(`  Thought: ${thought}`);
    console.log(`  Conclusion: ${conclusion}`);

    const result = await this.client.state.submitAction(
      this.config.id,
      "reason",
      {
        thought,
        conclusion,
        cycle: this.cycleCount,
      },
    );

    // Store the reasoning in working memory
    await this.client.state.setVariable(
      "last_reasoning",
      {
        thought,
        conclusion,
        timestamp: new Date().toISOString(),
      },
      "reasoning",
    );

    return result;
  }

  /**
   * Update a goal's status
   */
  async updateGoalStatus(
    goalId: string,
    status: "active" | "suspended" | "achieved" | "abandoned" | "failed",
  ): Promise<void> {
    console.log(`\n[${this.config.name}] Updating goal ${goalId} to ${status}`);

    await this.client.state.updateGoal(goalId, status);

    await this.client.state.submitAction(this.config.id, "reason", {
      thought: `Goal status changed to ${status}`,
      goal_id: goalId,
    });
  }

  /**
   * Get the agent's current state summary
   */
  async getStateSummary(): Promise<void> {
    console.log(`\n[${this.config.name}] State Summary`);
    console.log("=".repeat(50));

    // Variables
    const variables = await this.client.state.listVariables();
    console.log(`\nWorking Memory (${variables.length} variables):`);
    variables.forEach((v: any) => {
      const valueStr = JSON.stringify(v.value);
      const truncated =
        valueStr.length > 50 ? valueStr.substring(0, 47) + "..." : valueStr;
      console.log(`  - ${v.name}: ${truncated} (${v.source})`);
    });

    // Goals
    const goals = await this.client.state.listGoals();
    console.log(`\nGoals (${goals.length} total):`);
    goals.forEach((g: any) => {
      console.log(`  - [${g.priority}/${g.status}] ${g.description}`);
    });

    // Concepts
    const concepts = await this.client.state.listConcepts();
    console.log(`\nConcepts (${concepts.length} defined):`);
    concepts.forEach((c: any) => {
      console.log(`  - ${c.name}`);
    });

    // Recent actions
    const actions = await this.client.state.getActionLog(5);
    console.log(`\nRecent Actions (last 5):`);
    actions.forEach((a: any) => {
      console.log(`  - [${a.actionType}] ${a.success ? "✓" : "✗"}`);
    });

    // Cycle history
    const cycles = await this.client.state.getCycleHistory(3);
    console.log(`\nRecent Cycles (last 3):`);
    cycles.forEach((c: any) => {
      console.log(
        `  - Cycle ${c.cycle_number}: ${c.planning_time_ms}ms planning, ${c.execution_time_ms}ms execution`,
      );
    });

    console.log("=".repeat(50));
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`\n[${this.config.name}] Shutting down...`);

    await this.client.state.setVariable("agent_status", "shutdown", "system");

    await this.client.state.submitAction(this.config.id, "reason", {
      thought: "Agent shutting down",
      total_cycles: this.cycleCount,
    });

    console.log(
      `[${this.config.name}] Shutdown complete. Total cycles: ${this.cycleCount}`,
    );
  }
}

async function main() {
  const timestamp = Date.now();
  const runId = `cognitive-agent-${timestamp}`;

  console.log("=".repeat(60));
  console.log("Cognitive Agent Example");
  console.log("=".repeat(60));
  console.log(`Run ID: ${runId}`);

  const client = new Client({
    runId,
    configPath: path.resolve(__dirname, "../rice.config.js"),
  });

  try {
    console.log("\nConnecting to State service...");
    await client.connect();
    console.log("Connected.");

    // Create and initialize the agent
    const agent = new CognitiveAgent(client, {
      id: "cognitive-agent-1",
      name: "ResearchBot",
      description: "A cognitive agent that researches and learns",
    });

    await agent.initialize();

    // =========================================================================
    // Scenario: Research Task
    // =========================================================================
    console.log("\n" + "=".repeat(60));
    console.log("SCENARIO: Research Task");
    console.log("=".repeat(60));

    // 1. Set up goals
    const mainGoal = await agent.addGoal(
      "Research and summarize information about AI agents",
      "high",
    );

    const subGoal1 = await agent.addGoal(
      "Gather observations from available sources",
      "medium",
      mainGoal.id,
    );

    const subGoal2 = await agent.addGoal(
      "Synthesize findings into coherent knowledge",
      "medium",
      mainGoal.id,
    );

    // 2. Observe some information
    await agent.observe(
      "Cognitive architectures provide a framework for building intelligent agents",
      "documentation",
      0.95,
    );

    await agent.observe(
      "Working memory is crucial for maintaining context during reasoning",
      "research_paper",
      0.88,
    );

    await agent.observe(
      "Goal-directed behavior enables autonomous decision making",
      "textbook",
      0.92,
    );

    // 3. Wait for indexing
    console.log("\nWaiting 3s for memory indexing...");
    await new Promise((r) => setTimeout(r, 3000));

    // 4. Recall and reason
    const memories = await agent.recall("cognitive architecture reasoning");
    console.log(`\nRecalled ${memories.length} relevant memories.`);

    await agent.reason(
      "Based on observations, cognitive architectures with working memory and goal management are effective for building intelligent agents",
      "The State service provides all necessary components for building a cognitive agent",
    );

    // 5. Run decision cycles
    await agent.runDecisionCycle([
      {
        actionType: "reason",
        action: {
          thought: "Need more information about specific implementations",
        },
        score: 0.7,
        rationale: "Current knowledge is general",
      },
      {
        actionType: "retrieve",
        action: { query: "specific agent implementations" },
        score: 0.8,
        rationale: "Would provide concrete examples",
      },
      {
        actionType: "learn",
        action: { fact: "Synthesize current findings" },
        score: 0.6,
        rationale: "Have enough for initial synthesis",
      },
    ]);

    await agent.runDecisionCycle([
      {
        actionType: "reason",
        action: { thought: "Synthesizing research findings" },
        score: 0.9,
        rationale: "Ready to conclude research phase",
      },
      {
        actionType: "ground",
        action: { tool: "generate_report" },
        score: 0.5,
        rationale: "Could generate formal report",
      },
    ]);

    // 6. Mark goals as achieved
    await agent.updateGoalStatus(subGoal1.id, "achieved");
    await agent.updateGoalStatus(subGoal2.id, "achieved");
    await agent.updateGoalStatus(mainGoal.id, "achieved");

    // 7. Get final state summary
    await agent.getStateSummary();

    // 8. Shutdown
    await agent.shutdown();

    // 9. Cleanup
    console.log("\nCleaning up run data...");
    try {
      await client.state.deleteRun();
      console.log("Cleanup complete.");
    } catch (cleanupError: any) {
      console.warn(
        "Warning: Failed to cleanup run data:",
        cleanupError.message,
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("COGNITIVE AGENT EXAMPLE COMPLETE");
    console.log("=".repeat(60));
  } catch (e: any) {
    console.error("\nError:", e.message);
    console.error(e.stack);
  }
}

main();
