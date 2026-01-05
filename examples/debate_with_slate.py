import os
import sys
import time
import concurrent.futures
from dotenv import load_dotenv

# Add slate_client to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../clients/python/src')))

# Load env from clients/python/.env if variables are missing
if not os.environ.get("GEMINI_API_KEY"):
    env_path = os.path.join(os.path.dirname(__file__), '../clients/python/.env')
    load_dotenv(env_path)

from google import genai
from google.genai import types
from slate_client import CortexClient

# --- Configuration ---
SLATE_URL = os.environ.get("SLATE_INSTANCE_URL", "localhost:50051")
SLATE_TOKEN = os.environ.get("SLATE_AUTH_TOKEN", "dev_secret")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_KEY:
    print("Error: GEMINI_API_KEY not set.")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_KEY, http_options={'api_version': 'v1alpha'})
model_id = "gemini-3-flash-preview"

print(f"Connecting to Slate at {SLATE_URL}...")
slate = CortexClient(address=SLATE_URL, token=SLATE_TOKEN)

# --- Tools ---

def search_knowledge(query: str) -> str:
    """Simulates searching external knowledge bases."""
    # print(f"  [Tool] Searching: {query}")
    return f"Simulated search results for: {query} (EU AI Act, GDPR, Market Data)"

def search_debate_history(query: str) -> str:
    """Searches the debate history for relevant arguments."""
    print(f"  [Slate] Semantic search for: {query}")
    try:
        # Use reminisce to find relevant episodic memories (trace of debate)
        resp = slate.reminisce(query, limit=5)
        if not resp.traces:
            return "No relevant arguments found."
        
        results = []
        for t in resp.traces:
            results.append(f"[{t.action}] {t.input} -> {t.outcome}")
        return "\n".join(results)
    except Exception as e:
        return f"Error searching history: {e}"

def read_recent_state() -> str:
    """Reads only the most recent items from working memory."""
    # print("  [Slate] Reading recent state...")
    try:
        resp = slate.drift()
        if not resp.items:
            return "Shared state is empty."
        # Only take last 5 items to simulate "Working Memory" focus
        items = [f"[{item.id}] {item.content}" for item in resp.items[-5:]]
        return "\n".join(items)
    except Exception as e:
        return f"Error reading state: {e}"

def contribute_to_debate(agent_name: str, content: str, round_id: int) -> str:
    """Writes a contribution to the shared debate state."""
    header = f"[{agent_name} | Round {round_id}]"
    print(f"  [Slate] {header} contributing...")
    try:
        slate.focus(f"{header} {content}")
        slate.commit(content, "Debate Contribution", action=agent_name, reasoning=f"Round {round_id}")
        return "Contribution logged."
    except Exception as e:
        return f"Error logging: {e}"

# --- Agent Factory ---

def run_agent(name: str, role_prompt: str, round_id: int, topic: str):
    # print(f"--- Running {name} (Round {round_id}) ---")
    
    system_instruction = (
        f"You are {name}. {role_prompt}\n"
        "1. Use 'read_recent_state' to see the latest contributions.\n"
        "2. Use 'search_debate_history' to find specific arguments relevant to your domain.\n"
        "3. Use 'search_knowledge' if you need external facts.\n"
        "4. Formulate your argument/critique/finding.\n"
        "5. Contribute to the debate using 'contribute_to_debate'."
    )
    
    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            tools=[read_recent_state, search_debate_history, search_knowledge, contribute_to_debate],
            system_instruction=system_instruction
        )
    )
    
    user_msg = f"Topic: {topic}. Current Round: {round_id}. Please contribute."
    response = chat.send_message(user_msg)
    # print(f"[{name}] Finished.")
    return response.usage_metadata.total_token_count

# --- Roles ---

AGENTS = {
    "MarketAnalyst": "Analyze market size, growth, competitors, and strategic opportunities.",
    "TechAdvisor": "Analyze technical feasibility, architecture, compliance with standards, and implementation risks.",
    "LegalAdvisor": "Analyze regulatory compliance (EU AI Act, GDPR), legal risks, and liability.",
    "FinancialAnalyst": "Analyze costs, ROI, budget implications, and financial risks.",
    "Ethicist": "Analyze societal impact, bias, fairness, and ethical implications of the expansion."
}

def run_synthesizer(topic: str):
    print(f"\n--- SYNTHESIZER AGENT: Final Brief ---")
    
    system_instruction = (
        "You are the Chief Synthesizer. Use 'search_debate_history' to gather key arguments from all perspectives. "
        "Produce a comprehensive executive brief that weighs all perspectives (Market, Tech, Legal, Financial, Ethical). "
        "Provide a final Go/No-Go recommendation."
    )
    
    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            tools=[search_debate_history],
            system_instruction=system_instruction
        )
    )
    
    response = chat.send_message(f"Generate the final brief for: {topic}")
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
    
    for r in range(1, rounds + 1):
        print(f"\n--- ROUND {r} START ---")
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for name, role in AGENTS.items():
                futures.append(executor.submit(run_agent, name, role, r, topic))
            
            for future in concurrent.futures.as_completed(futures):
                total_tokens += future.result()
        print(f"--- ROUND {r} COMPLETE ---")

    # Final Synthesis
    total_tokens += run_synthesizer(topic)
    
    duration = time.time() - start_time
    print(f"\n[Metrics] Workflow completed in {duration:.2f}s")
    print(f"[Metrics] Total Token Usage (With Slate): {total_tokens}")
    print("[Observability] Check Slate Dashboard for full decision trace.")

if __name__ == "__main__":
    main()
