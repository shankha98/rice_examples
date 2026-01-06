import random

def generate_gameplay_logs(num_entries=500):
    """Generates a list of simulated gameplay logs with hidden 'needles'."""
    
    actions = ["Walked to", "Looted", "Fought", "Crafted", "Talked to", "Completed quest"]
    locations = ["Forest", "Cave", "Town Square", "Tavern", "Mountain Path", "River Bank"]
    items = ["Apple", "Rusty Sword", "Leather Scraps", "Gold Coin", "Potion", "Arrow"]
    mobs = ["Wolf", "Bandit", "Goblin", "Rat", "Skeleton"]
    npcs = ["Merchant", "Guard", "Villager", "Beggar"]

    logs = []
    
    # Generate noise
    for _ in range(num_entries):
        action = random.choice(actions)
        if action == "Walked to":
            logs.append(f"Player walked to {random.choice(locations)}.")
        elif action == "Looted":
            logs.append(f"Player looted {random.choice(items)}.")
        elif action == "Fought":
            logs.append(f"Player fought {random.choice(mobs)}.")
        elif action == "Talked to":
            logs.append(f"Player talked to {random.choice(npcs)}.")
        else:
            logs.append(f"Player performed action: {action} in {random.choice(locations)}.")

    # Insert Needles (The important context)
    # We scatter them to make it harder for simple context windows if they get truncated or lost in noise
    
    # Needle 1: The Quest Start (Early in the logs)
    logs.insert(num_entries // 10, "Player accepted quest 'Retrieve the Ancestral Hammer' from Blacksmith Gorn.")
    
    # Needle 2: The struggle (Middle)
    logs.insert(num_entries // 2, "Player was defeated by the Cave Troll but escaped.")
    logs.insert(num_entries // 2 + 1, "Player returned to Cave and defeated Cave Troll.")
    
    # Needle 3: The Discovery (Late)
    logs.insert(num_entries - 10, "Player found 'Ancestral Hammer' in the Troll's hoard.")
    
    # Needle 4: A distraction/red herring
    logs.insert(num_entries - 5, "Player sold 'Rusty Hammer' to General Merchant.")

    return logs
