import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

// For library usage, we expect proto file to be in ./proto relative to built file
// But since we use protoLoader, we need the file present.
const PROTO_PATH = path.join(__dirname, "proto", "slate.proto");

export class CortexClient {
  private client: any;
  private metadata: any;

  constructor(address: string = "localhost:50051", token?: string) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(
      packageDefinition
    ) as any;
    const slate = protoDescriptor.slate;
    this.client = new slate.Cortex(address, grpc.credentials.createInsecure());

    this.metadata = new grpc.Metadata();
    if (token) {
      this.metadata.add("authorization", token);
    }
  }

  focus(content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.Focus(
        { content },
        this.metadata,
        (err: any, response: any) => {
          if (err) reject(err);
          else resolve(response.id);
        }
      );
    });
  }

  drift(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.client.Drift({}, this.metadata, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response.items || []);
      });
    });
  }

  commit(
    input: string,
    outcome: string,
    options?: { action?: string; reasoning?: string; agent_id?: string }
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const trace = {
        input,
        outcome,
        reasoning: options?.reasoning || "Node Client",
        action: options?.action || "Action",
        agent_id: options?.agent_id || "node-user",
        embedding: [], // Mock
      };
      this.client.Commit(trace, this.metadata, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response.success);
      });
    });
  }

  reminisce(query: string, limit: number = 5): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const req = {
        embedding: [],
        limit,
        query_text: query,
      };
      this.client.Reminisce(req, this.metadata, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response.traces || []);
      });
    });
  }

  trigger(skillName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = {
        skill_name: skillName,
      };
      this.client.Trigger(req, this.metadata, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response.result);
      });
    });
  }
}
