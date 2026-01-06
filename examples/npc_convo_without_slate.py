import os
import sys
import time
from dotenv import load_dotenv
from game_data_generator import generate_gameplay_logs

# Load env from clients/python/.env if variables are missing
if not os.environ.get("GEMINI_API_KEY"):
    env_path = os.path.join(os.path.dirname(__file__), "../clients/python/.env")
    load_dotenv(env_path)

from google import genai
from google.genai import types

# --- Configuration ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_KEY:
    print("Error: GEMINI_API_KEY not set.")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_KEY, http_options={"api_version": "v1alpha"})
model_id = "gemini-3-flash-preview"

# --- Agent ---


def generate_npc_dialogue(npc_name: str, player_context: str, history_logs: list):
    print(f"\n--- Generative NPC (No Slate): {npc_name} ---")

    # Flatten history into a massive string
    full_history = "\n".join(history_logs)

    system_instruction = (
        f"You are {npc_name}, an NPC in an open world RPG. "
        "Generate a single dialogue line to greet the player. "
        "You have access to the ENTIRE gameplay history below. "
        "1. Check if the player completed your quest. "
        "2. If they completed your quest, thank them. "
        "3. If they found the item but sold it, be angry. "
        "4. If they haven't started, offer the quest. "
        "5. Be immersive."
    )

    # We pass the full history in the prompt (Simulating standard Context Window approach)
    prompt = (
        f"GAMEPLAY HISTORY:\n{full_history}\n\n"
        f"CURRENT SITUATION: Player approaches you. {player_context}\n"
        f"Respond as {npc_name}:"
    )

    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(system_instruction=system_instruction),
    )

    start_time = time.time()
    response = chat.send_message(prompt)
    duration = time.time() - start_time

    print(f"{npc_name}: {response.text}")
    print(
        f"[Metrics] Response generated in {duration:.2f}s (High Latency due to context processing)"
    )
    print(
        f"[Metrics] Token Usage: {response.usage_metadata.total_token_count} (High Cost)"
    )
    return duration


# --- Main Flow ---


def main():
    print("Generating Gameplay Data (Large History)...")
    # Simulate a long playthrough to demonstrate context bloat
    logs = generate_gameplay_logs(num_entries=1000)
    print(f"Generated {len(logs)} log entries.")

    # Estimate token count of history
    estimated_tokens = len("\n".join(logs)) // 4
    print(f"Estimated History Context: ~{estimated_tokens} tokens")

    print("\n[Phase 2] Interaction")
    # Scenario: Player talks to Blacksmith Gorn

    generate_npc_dialogue("Blacksmith Gorn", "Player stands before you.", logs)


if __name__ == "__main__":
    main()
