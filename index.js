// Imports
const fs = require("fs");
const ethers = require("ethers");
const { abi } = require("./abi");

// Setup contract
const lootAddress = "0x8707276df042e89669d69a177d3da7dc78bd8723";
const rpc = new ethers.providers.JsonRpcProvider(process.env.RPC_CONNSTRING);
const loot = new ethers.Contract(lootAddress, abi, rpc);

async function collect(i) {
  console.log("Collecting: ", i);

  // Collect parts
  const [clothes, foot, hand, neck, ring, waist, weapon, drugs, vehicle] =
    await Promise.all([
      loot.getClothes(i),
      loot.getFoot(i),
      loot.getHand(i),
      loot.getNeck(i),
      loot.getRing(i),
      loot.getWaist(i),
      loot.getWeapon(i),
      loot.getDrugs(i),
      loot.getVehicle(i),
    ]);

  return {
    clothes,
    foot,
    hand,
    neck,
    ring,
    waist,
    weapon,
    drugs,
    vehicle
  }
}

(async () => {
  // In-mem retrieval
  let retrievedLoot = [];

  // Collect 1...8000 ids
  for (let i = 1; i <= 8000; i++) {
    try {
      const loot = await collect(i)
      // Push parts to array
      retrievedLoot.push({
        [i]: loot,
      });
    } catch (err) {
      console.log(err)
      console.log("Retrying: ", i)

      const loot = await collect(i)
      // Push parts to array
      retrievedLoot.push({
        [i]: loot,
      });
    }
  }

  // Write output
  fs.writeFileSync("./output/loot.json", JSON.stringify(retrievedLoot));
})();
