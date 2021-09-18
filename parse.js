// Imports
const fs = require("fs");
const parts = require("./output/item-parts.json");

const { suffixes, namePrefixes, nameSuffixes } = parts;

(async () => {
  // Load loot data
  const data = await fs.readFileSync("./output/loot.json");
  const loot = JSON.parse(data);

  // Calculate attribute rarities
  let occurences = {};
  for (let i = 0; i < loot.length; i++) {
    const attributes = loot[i][(i + 1).toString()];

    // Add up number of occurences of attributes
    for (const attribute of Object.values(attributes)) {
      occurences[attribute] = occurences[attribute]
        ? occurences[attribute] + 1
        : 1;
    }
  }

  // Output occurences
  await fs.writeFileSync(
    "./output/occurences.json",
    JSON.stringify(occurences, null, 4)
  );

  // Calculate occurence rare
  let rare = [];
  for (let i = 0; i < loot.length; i++) {
    let score = 0;
    const attributes = loot[i][(i + 1).toString()];

    for (const attribute of Object.values(attributes)) {
      score += occurences[attribute];
    }
    rare.push({ lootId: i + 1, score });
  }

  // Calculate pure probability
  let probability = [];
  for (let i = 0; i < loot.length; i++) {
    let rare = [];
    const attributes = loot[i][(i + 1).toString()];

    for (const attribute of Object.values(attributes)) {
      // Collect probability of individual attribute occurences
      rare.push(occurences[attribute] / 8000);
    }

    // Multiply probabilites P(A and B) = P(A) * P(B)
    const p = rare.reduce((a, b) => a * b);
    probability.push({ lootId: i + 1, score: p });
  }

  // Sort by probability
  probability = probability.sort((a, b) => a.score - b.score);
  // Sort by index of probability
  probability = probability.map((loot, i) => ({
    ...loot,
    score: Math.abs(Math.log(loot.score)),
    rarest: i + 1,
  }));

  // Print loot rarity by score
  await fs.writeFileSync(
    "./output/probability.json",
    JSON.stringify(probability, null, 4)
  );

  // Calculate attribute rarities
  let items = {};
  for (let i = 0; i < loot.length; i++) {
    const attributes = loot[i][(i + 1).toString()];

    // Add up number of occurences of attributes
    for (const [attribute, item] of Object.entries(attributes)) {
      if (attribute in items) {
        items[attribute].push(item)
        continue
      }
      items[attribute] = [item];
    }
  }

  for (const [attribute, item] of Object.entries(items)) {
    items[attribute] = Array.from(new Set(item))
  }

  // Output items
  await fs.writeFileSync(
    "./output/items.json",
    JSON.stringify(items, null, 4)
  );

  const itemCount = {
    clothes: 0,
    foot: 0,
    hand: 0,
    drugs: 0,
    neck: 0,
    ring: 0,
    waist: 0,
    weapon: 0,
    vehicle: 0,
  };

  const itemsCounted = Object.keys(items).reduce((acc, key) => {
    acc[key] = items[key].length;
    return acc;
  }, itemCount);

  // Output item counts
  fs.writeFileSync(
    "./output/item-count.json",
    JSON.stringify(itemsCounted, null, 4)
  );

  const inventorySlots = {
    clothes: [],
    foot: [],
    hand: [],
    drugs: [],
    neck: [],
    ring: [],
    waist: [],
    weapon: [],
    vehicle: [],
  };

  let rareUpdate = [];
  const itemParts = [];
  loot.reduce((slots, bag, index) => {
    let itemScore = 0;
    const id = index + 1;
    const bagSlots = bag[id];
    const existingRarity = rare.find((item) => item.lootId === id);

    Object.keys(bagSlots).forEach((slot) => {
      const item = bagSlots[slot];
      const itemPart = parseItemParts(bagSlots);
      itemParts.push({ [id]: itemPart });
      itemScore += itemPart[slot].score;

      if (!slots[slot].includes(item)) {
        slots[slot] = [...slots[slot], item];
      }
    });

    rareUpdate.push({
      ...existingRarity,
      itemScore,
    });

    return slots;
  }, inventorySlots);

  // Sort by score
  rareUpdate = rareUpdate.sort((a, b) => a.score - b.score);
  // Sort by index of score
  rareUpdate = rareUpdate.map((loot, i) => ({
    ...loot,
    rarest: i + 1,
  }));

  // Print loot rarity by score
  await fs.writeFileSync("./output/rare.json", JSON.stringify(rareUpdate, null, 4));

  // Generate item rarities
  const byLevel = Object.entries(occurences).reduce(
    (byLevel, [name, occurences]) => {
      const level = levelFromOccurences(Number(occurences));
      byLevel[name] = level;
      return byLevel;
    },
    {}
  );

  // Output item rarities
  fs.writeFileSync(
    "./output/item-rarities.json",
    JSON.stringify(byLevel, null, 4)
  );

  // Common:       above 350     34.9% (25129 items)
  // Uncommon:   350 or less    20.18% (14528 items)
  // Rare:       310 or less    16.51% (11889 items)
  // Epic:       130 or less    10.27%  (7393 items)
  // Legendary:    7 or less     9.21%  (6634 items)
  // Mythic:       exactly 1     8.93%  (6427 items)
  function levelFromOccurences(occurences) {
    for (let i = 1, len = 6; i < len; i++) {
      if (occurences > [-1, 350, 310, 130, 7, 1][i]) {
        return i;
      }
    }
    return 6;
  }

  function parseItemParts(item) {
    return Object.keys(item).reduce((acc, slot) => {
      let score = 1;
      const name = item[slot];

      acc[slot] = {
        item: findItemType(name, parts),
        suffix: suffixes.find((suffix) => name.includes(suffix)) || null,
        namePrefix: namePrefixes.find((prefix) => name.includes(prefix)) || null,
        nameSuffix: nameSuffixes.find((suffix) => name.includes(suffix)) || null,
        bonus: name.includes("+1"),
      };
      if (acc[slot].suffix) score++;
      if (name.startsWith('"')) score++;
      if (acc[slot].bonus) score++;

      acc[slot].score = score;
      return acc;
    }, {});
  }

  function findItemType(item, parts) {
    const hasPart = (part) => item.includes(part);
    const weapon = parts.weapons.filter(hasPart)[0];
    if (weapon) return weapon;
    const clothes = parts.clothes.filter(hasPart)[0];
    if (clothes) return clothes;
    const drugs = parts.drugs.filter(hasPart)[0];
    if (drugs) return drugs;
    const vehicle = parts.vehicle.filter(hasPart)[0];
    if (vehicle) return vehicle;
    const waist = parts.waistArmor.filter(hasPart)[0];
    if (waist) return waist;
    const foot = parts.footArmor.filter(hasPart)[0];
    if (foot) return foot;
    const hand = parts.handArmor.filter(hasPart)[0];
    if (hand) return hand;
    const necklace = parts.necklaces.filter(hasPart)[0];
    if (necklace) return necklace;
    const ring = parts.rings.filter(hasPart)[0];
    if (ring) return ring;
  }
})();

