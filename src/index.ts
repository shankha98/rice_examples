import { RiceDBClient } from "rice-node-sdk";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function main() {
  const url =
    process.env.STORAGE_INSTANCE_URL ||
    process.env.RICEDB_HOST ||
    "localhost:50051";
  const token = process.env.STORAGE_AUTH_TOKEN;
  console.log(`Connecting to Storage at ${url}`);

  let host = "localhost";
  let grpcPort = 50051;
  const parts = url.split(":");
  if (parts.length === 2) {
    host = parts[0];
    grpcPort = parseInt(parts[1], 10);
  } else {
    host = url;
  }

  // HTTP Port is 80 if provided in env, else 3000
  const httpPort = process.env.STORAGE_HTTP_PORT
    ? parseInt(process.env.STORAGE_HTTP_PORT, 10)
    : 3000;

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
