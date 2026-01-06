# Slate Node.js Client

This is the Node.js client for the [Slate](https://github.com/rice-ai-hq/slate) cognitive architecture framework.

## Installation

```bash
npm install slate-client
```

## Usage

```typescript
import { CortexClient } from "slate-client";

const client = new CortexClient("localhost:50051", "your-auth-token");

async function main() {
  // Store memory
  const id = await client.focus("Hello world");

  // Retrieve context
  const items = await client.drift();
  console.log(items);
}

main();
```

See [examples](./examples) for more advanced usage including Agent implementations.
