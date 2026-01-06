import os
import sys
import time
from dotenv import load_dotenv
from game_data_generator import generate_gameplay_logs

# Add slate_client to path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../clients/python/src"))
)

# Load env from clients/python/.env
env_path = os.path.join(os.path.dirname(__file__), "../clients/python/.env")
load_dotenv(env_path, override=True)  # Force load to get the correct SLATE token

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

client = genai.Client(api_key=GEMINI_KEY, http_options={"api_version": "v1alpha"})
model_id = "gemini-3-flash-preview"

print(f"Connecting to Slate at {SLATE_URL}...")
print(f"Using Token: {SLATE_TOKEN}")
slate = CortexClient(address=SLATE_URL, token=SLATE_TOKEN)

# --- Tools ---


def recall_relevant_memories(query: str) -> str:
    """Searches gameplay history for relevant events."""
    print(f"  [Slate] Semantic search for: '{query}'")
    try:
        # Try Reminisce first
        resp = slate.reminisce(query, limit=3)
        if resp and hasattr(resp, "traces") and resp.traces:
            results = [f"- {t.input}" for t in resp.traces]
            result_str = "\n".join(results)
            print(f"  [Slate] Retrieved (Long-Term):\n{result_str}")
            return result_str
        else:
            print("  [Slate] No relevant memories found in Long-Term.")
    except Exception as e:
        print(f"  [Slate] Long-Term Search error ({e}). Checking Working Memory...")

    # Fallback to Drift (Working Memory)
    try:
        resp = slate.drift()
        if resp and hasattr(resp, "items") and resp.items:
            # Simple keyword matching since drift is just a list
            # In a real app, you'd do client-side filtering or rely on Slate's relevance
            results = []
            keywords = query.lower().split()
            for item in resp.items:
                content = item.content
                if any(k in content.lower() for k in keywords):
                    results.append(f"- {content}")

            # If no keyword match, just return recent context
            if not results:
                results = [f"- {item.content}" for item in resp.items[:5]]

            result_str = "\n".join(results[:5])  # Limit to 5
            print(f"  [Slate] Retrieved (Working Memory):\n{result_str}")
            return result_str
    except Exception as e:
        return f"Error retrieving memories: {e}"

    return "No relevant memories found."


# --- Agent ---


def generate_npc_dialogue(npc_name: str, player_context: str):
    print(f"\n--- Generative NPC: {npc_name} ---")

    system_instruction = (
        f"You are {npc_name}, an NPC in an open world RPG. "
        "Generate a single dialogue line to greet the player. "
        "1. Use 'recall_relevant_memories' to check what the player has done related to you or your quests. "
        "2. If they completed your quest, thank them. "
        "3. If they found the item but sold it, be angry. "
        "4. If they haven't started, offer the quest. "
        "5. Be immersive."
    )

    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            tools=[recall_relevant_memories], system_instruction=system_instruction
        ),
    )

    start_time = time.time()
    response = chat.send_message(f"Player approaches you. {player_context}")
    duration = time.time() - start_time

    print(f"{npc_name}: {response.text}")
    print(f"[Metrics] Response generated in {duration:.2f}s")
    print(f"[Metrics] Token Usage: {response.usage_metadata.total_token_count}")
    return duration


# --- Main Flow ---


def main():
    print("Generating Gameplay Data...")
    logs = generate_gameplay_logs(
        num_entries=1000
    )  # Keep small for ingestion speed in demo
    print(f"Generated {len(logs)} log entries.")

    print("\n[Phase 1] Ingesting into Slate (Simulating Gameplay)...")
    ingest_start = time.time()
    # Ingesting
    for i, log in enumerate(logs):
        # We assume 'action' is just "Gameplay" for all
        try:
            # Use focus to ensure it's in Working Memory (Drift) accessible by this token
            slate.focus(log)
            # Also commit for persistence (even if search is ACL-gated right now)
            slate.commit(log, "Game Event", action="Gameplay", reasoning="Log")

            if i % 10 == 0:
                print(f"  Processed {i}/{len(logs)} logs...", end="\r")
        except Exception as e:
            print(f"Error processing: {e}")

    print(f"\nIngestion complete in {time.time() - ingest_start:.2f}s")
    print("Waiting for indexing (10s)...")
    time.sleep(10)

    print("\n[Phase 2] Interaction")
    # Scenario: Player talks to Blacksmith Gorn
    # Relevant Needles in logs:
    # "Player accepted quest 'Retrieve the Ancestral Hammer' from Blacksmith Gorn."
    # "Player found 'Ancestral Hammer' in the Troll's hoard."
    # "Player sold 'Rusty Hammer'..." (Red herring)

    generate_npc_dialogue("Blacksmith Gorn", "Player stands before you.")


if __name__ == "__main__":
    main()
