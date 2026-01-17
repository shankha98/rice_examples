import { RiceDBClient } from "rice-node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const url = process.env.STORAGE_INSTANCE_URL;
  const token = process.env.STORAGE_AUTH_TOKEN;

  const db = new RiceDBClient(url, "auto", 50051, 80, token);

  try {
    await db.connect();
    const health = await db.health();

    console.log("Health:", health);

    db.disconnect();
  } catch (e) {
    console.error("Storage connection failed:", e);
  }
}

await main().catch(console.error);
