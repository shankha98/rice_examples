install:
	clear
	bun install

run:
	clear
	bun run src/index.ts

run-agent:
	clear
	bun run src/cognitive_agent.ts

run-vercel:
	clear
	bun run src/vercel_agent.ts
