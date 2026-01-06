import { ChatSession } from "@google/generative-ai";

export async function runChatLoop(
  chat: ChatSession,
  message: string,
  toolsMap: any
) {
  let result = await chat.sendMessage(message);
  let response = result.response;

  while (true) {
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];
      for (const call of functionCalls) {
        const name = call.name;
        const args = call.args;
        console.log(`[Tool Call] ${name}`);

        let output;
        if (toolsMap[name]) {
          output = await toolsMap[name](args);
        } else {
          output = `Error: Tool ${name} not found`;
        }
        console.log(`[Tool Output]`, output);

        functionResponses.push({
          functionResponse: {
            name: name,
            response: { result: output },
          },
        });
      }
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    } else {
      break;
    }
  }
  return response.text();
}
