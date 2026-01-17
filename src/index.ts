import { RiceDBClient } from "rice-node-sdk";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function main() {
  const url = process.env.STORAGE_INSTANCE_URL || "localhost:50051";
  const [host, portStr] = url.split(":");
  const grpcPort = portStr ? parseInt(portStr, 10) : 50051;
  const httpPort = parseInt(process.env.STORAGE_HTTP_PORT || "3000", 10);
  const token = process.env.STORAGE_AUTH_TOKEN;

  console.log(`Connecting to Storage at ${host}:${grpcPort}`);

  const db = new RiceDBClient(host, "auto", grpcPort, httpPort, token);

  try {
    await db.connect();
    console.log("Storage connected successfully");

    const health = await db.health();
    console.log("Health:", health);

    db.disconnect();
  } catch (e) {
    console.error("Storage connection failed:", e);
  }
}
main().catch(console.error);
