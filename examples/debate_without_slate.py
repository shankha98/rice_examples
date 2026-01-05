import os
import sys
import time
import concurrent.futures
from dotenv import load_dotenv

# Load env from clients/python/.env if variables are missing
if not os.environ.get("GEMINI_API_KEY"):
    env_path = os.path.join(os.path.dirname(__file__), '../clients/python/.env')
    load_dotenv(env_path)

from google import genai
from google.genai import types

# --- Configuration ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_KEY:
    print("Error: GEMINI_API_KEY not set.")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_KEY, http_options={'api_version': 'v1alpha'})
model_id = "gemini-3-flash-preview"

# --- Tools ---

def search_knowledge(query: str) -> str:
    """Simulates searching external knowledge bases."""
    # print(f"  [Tool] Searching: {query}")
    return f"Simulated search results for: {query} (EU AI Act, GDPR, Market Data)"

# --- Agent Factory ---

def run_agent(name: str, role_prompt: str, round_id: int, topic: str, context: list):
    # print(f"--- Running {name} (Round {round_id}) ---")
    
    # Simulate context passing
    full_context_str = "\n".join(context)
    
    system_instruction = (
        f"You are {name}. {role_prompt}\n"
        "1. Read the provided context to see what others have said.\n"
        "2. Use 'search_knowledge' if you need external facts.\n"
        "3. Formulate your argument/critique/finding.\n"
        "4. Output your contribution clearly."
    )
    
    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            tools=[search_knowledge],
            system_instruction=system_instruction
        )
    )
    
    user_msg = f"Topic: {topic}. Current Round: {round_id}. Context:\n{full_context_str}\n\nPlease contribute."
    response = chat.send_message(user_msg)
    
    output_text = f"[{name} | Round {round_id}]: {response.text}"
    print(f"  [Context] {name} output received.")
    
    return response.usage_metadata.total_token_count, output_text

# --- Roles ---

AGENTS = {
    "MarketAnalyst": "Analyze market size, growth, competitors, and strategic opportunities.",
    "TechAdvisor": "Analyze technical feasibility, architecture, compliance with standards, and implementation risks.",
    "LegalAdvisor": "Analyze regulatory compliance (EU AI Act, GDPR), legal risks, and liability.",
    "FinancialAnalyst": "Analyze costs, ROI, budget implications, and financial risks.",
    "Ethicist": "Analyze societal impact, bias, fairness, and ethical implications of the expansion."
}

def run_synthesizer(topic: str, context: list):
    print(f"\n--- SYNTHESIZER AGENT: Final Brief ---")
    
    full_context_str = "\n".join(context)
    
    system_instruction = (
        "You are the Chief Synthesizer. Read the entire debate context. "
        "Produce a comprehensive executive brief that weighs all perspectives (Market, Tech, Legal, Financial, Ethical). "
        "Provide a final Go/No-Go recommendation."
    )
    
    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction
        )
    )
    
    response = chat.send_message(f"Generate the final brief for: {topic}\nContext:\n{full_context_str}")
    print(f"\n=== FINAL BRIEF ===\n{response.text}\n===================")
    return response.usage_metadata.total_token_count

# --- Main Flow ---

def main():
    topic = "Expand portfolio company into EU market given new AI regulations"
    print(f"Objective: {topic}\n")
    print("[Setup] Parallel execution with 5 specialized agents over 3 rounds.")
    
    start_time = time.time()
    total_tokens = 0
    rounds = 3
    context = [] # Growing list of strings
    
    for r in range(1, rounds + 1):
        print(f"\n--- ROUND {r} START ---")
        round_outputs = []
        
        # We pass a copy of current context to all agents (Parallel Independent Execution)
        current_context_snapshot = list(context) 
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for name, role in AGENTS.items():
                futures.append(executor.submit(run_agent, name, role, r, topic, current_context_snapshot))
            
            for future in concurrent.futures.as_completed(futures):
                usage, output = future.result()
                total_tokens += usage
                round_outputs.append(output)
        
        # Append all outputs to the main context for the next round
        context.extend(round_outputs)
        print(f"--- ROUND {r} COMPLETE (Context size: {len(context)} items) ---")

    # Final Synthesis
    total_tokens += run_synthesizer(topic, context)
    
    duration = time.time() - start_time
    print(f"\n[Metrics] Workflow completed in {duration:.2f}s")
    print(f"[Metrics] Total Token Usage (Without Slate): {total_tokens}")

if __name__ == "__main__":
    main()
