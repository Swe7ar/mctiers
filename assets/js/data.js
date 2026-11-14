/* Static reference data. Player accounts live in localStorage and are managed
   by the admin -- players register themselves and the admin sets their tiers. */
window.MCT = {
  "site": "MCTiers",
  "points": { "HT1": 60, "LT1": 45, "HT2": 30, "LT2": 20, "HT3": 10, "LT3": 6, "HT4": 4, "LT4": 3, "HT5": 2, "LT5": 1 },
  "titles": [
    { "name": "Rookie", "min": 0 },
    { "name": "Combat Novice", "min": 10 },
    { "name": "Combat Cadet", "min": 20 },
    { "name": "Combat Specialist", "min": 50 },
    { "name": "Combat Ace", "min": 100 },
    { "name": "Combat Master", "min": 250 },
    { "name": "Combat Grandmaster", "min": 400 }
  ],
  "regions": {
    "NA": "North America", "EU": "Europe", "AS": "Asia", "SA": "South America",
    "OC": "Oceania", "AU": "Australia", "ME": "Middle East", "AF": "Africa"
  },
  "gamemodes": [
    { "id": "vanilla", "name": "Vanilla", "full": "Vanilla (Crystal PvP)", "icon": "vanilla", "blurb": "Crystal PvP" },
    { "id": "uhc", "name": "UHC", "full": "UHC (Ultra Hardcore)", "icon": "uhc", "blurb": "Golden apple duels" },
    { "id": "pot", "name": "Pot", "full": "Pot (Potion PvP)", "icon": "pot", "blurb": "Potion PvP" },
    { "id": "nethop", "name": "NethOP", "full": "NethOP (Netherite OP)", "icon": "nethop", "blurb": "Netherite OP" },
    { "id": "smp", "name": "SMP", "full": "SMP", "icon": "smp", "blurb": "Survival PvP" },
    { "id": "sword", "name": "Sword", "full": "Sword", "icon": "sword", "blurb": "Sword duels" },
    { "id": "axe", "name": "Axe", "full": "Axe", "icon": "axe", "blurb": "Axe duels" },
    { "id": "mace", "name": "Mace", "full": "Mace", "icon": "mace", "blurb": "Mace PvP" }
  ],
  "players": {},
  "overall": [],
  "totalRanked": 0
};
