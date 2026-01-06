import { CortexClient } from "./src/index";

async function main() {
  const token = "dev_secret";
  console.log(`Connecting with token: ${token}`);

  const client = new CortexClient("localhost:50051", token);

  try {
    const id = await client.focus("Hello Secure World");
    console.log("Focused:", id);

    console.log("Committing memory...");
    const success = await client.commit("Hello from Node", "Greeting sent");
    console.log("Committed:", success);

    console.log("Reminiscing...");
    const memories = await client.reminisce("Hello");
    memories.forEach((m: any) =>
      console.log(`Memory: ${m.input} -> ${m.outcome}`)
    );
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
