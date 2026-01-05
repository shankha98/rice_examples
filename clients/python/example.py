import os
import sys

# Ensure we can import the local package if running from here
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from slate_client import CortexClient

def main():
    token = "dev_secret" # Matches Makefile default
    print(f"Connecting with token: {token}")
    
    client = CortexClient(token=token)
    
    try:
        response = client.focus("Hello Secure World")
        print(f"Focused: {response.id}")

        print("Committing memory...")
        client.commit("User says hello", "Agent replied", reasoning="Greeting")

        print("Reminiscing...")
        memories = client.reminisce("hello", 1).traces
        for m in memories:
             print(f"Memory: {m.input} -> {m.outcome}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
