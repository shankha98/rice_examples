# Slate Agent Examples (Node.js)

This directory contains examples of using Slate with Google GenAI SDK to build agentic systems.

## Setup

1.  Ensure you have `npm` installed.
2.  Install dependencies from `clients/node` root:
    ```bash
    npm install
    ```
3.  Set environment variables:
    ```bash
    export GEMINI_API_KEY="your-gemini-key"
    # Ensure Slate server is running separately (e.g. `make run-ricedb`)
    export SLATE_AUTH_TOKEN="dev_secret"
    ```

## Examples

Run these examples from `clients/node/examples/` directory using `npx ts-node`.

### 1. Agent with Memory (`agent_with_memory.ts`)

A single agent that can remember context, commit experiences, and recall past interactions using Slate tools.

```bash
npx ts-node agent_with_memory.ts
```

### 2. Research Team (`research_team.ts`)

A multi-agent system where a "Researcher" agent gathers facts and stores them in Slate, and a "Writer" agent retrieves them to write a report.

```bash
npx ts-node research_team.ts
```

### 3. Complex Workflow (`complex_workflow.ts`)

A long-running workflow with Architect, Developer, and QA agents.

```bash
npx ts-node complex_workflow.ts
```

### 4. Cognitive Agent (`cognitive_agent.ts`)

Implementation of a Cognitive Architecture loop (Plan/Act/Reflect).

```bash
npx ts-node cognitive_agent.ts
```
