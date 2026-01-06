import { CortexClient } from "../src/index";

async function test() {
  console.log("Starting Node E2E Test...");
  const token = process.env.SLATE_AUTH_TOKEN;
  const client = new CortexClient("localhost:50051", token);

  try {
    const id = await client.focus("E2E Test Node");
    console.log("Focused ID:", id);
    if (!id) throw new Error("Focus returned empty ID");

    const items = await client.drift();
    console.log("Drift items:", items.length);

    console.log("Node E2E Test PASSED");
  } catch (e) {
    console.error("Node E2E Test FAILED:", e);
    process.exit(1);
  }
}

test();
