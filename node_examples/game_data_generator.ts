export function generateGameplayLogs(numEntries = 500) {
  const actions = [
    "Walked to",
    "Looted",
    "Fought",
    "Crafted",
    "Talked to",
    "Completed quest",
  ];
  const locations = [
    "Forest",
    "Cave",
    "Town Square",
    "Tavern",
    "Mountain Path",
    "River Bank",
  ];
  const items = [
    "Apple",
    "Rusty Sword",
    "Leather Scraps",
    "Gold Coin",
    "Potion",
    "Arrow",
  ];
  const mobs = ["Wolf", "Bandit", "Goblin", "Rat", "Skeleton"];
  const npcs = ["Merchant", "Guard", "Villager", "Beggar"];

  const logs: string[] = [];

  // Generate noise
  for (let i = 0; i < numEntries; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    let log = "";
    if (action === "Walked to") {
      log = `Player walked to ${
        locations[Math.floor(Math.random() * locations.length)]
      }.`;
    } else if (action === "Looted") {
      log = `Player looted ${items[Math.floor(Math.random() * items.length)]}.`;
    } else if (action === "Fought") {
      log = `Player fought ${mobs[Math.floor(Math.random() * mobs.length)]}.`;
    } else if (action === "Talked to") {
      log = `Player talked to ${
        npcs[Math.floor(Math.random() * npcs.length)]
      }.`;
    } else {
      log = `Player performed action: ${action} in ${
        locations[Math.floor(Math.random() * locations.length)]
      }.`;
    }
    logs.push(log);
  }

  // Insert Needles
  logs.splice(
    Math.floor(numEntries / 10),
    0,
    "Player accepted quest 'Retrieve the Ancestral Hammer' from Blacksmith Gorn."
  );
  logs.splice(
    Math.floor(numEntries / 2),
    0,
    "Player was defeated by the Cave Troll but escaped."
  );
  logs.splice(
    Math.floor(numEntries / 2) + 1,
    0,
    "Player returned to Cave and defeated Cave Troll."
  );
  logs.splice(
    numEntries - 10,
    0,
    "Player found 'Ancestral Hammer' in the Troll's hoard."
  );
  logs.splice(
    numEntries - 5,
    0,
    "Player sold 'Rusty Hammer' to General Merchant."
  );

  return logs;
}
