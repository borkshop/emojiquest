// @ts-check

import {assert} from './assert.js';

export const agentTypes = [
  // { name: 'empty' },
  { name: 'player', tile: 'happy' },
  { name: 'pineTree' },
  { name: 'appleTree' },
  { name: 'axe' },
  { name: 'mountain' },
  { name: 'pick' },
  { name: 'bank' },
  { name: 'forge' },
];

export const itemTypes = [
  { name: 'empty' },
  { name: 'apple' },
  { name: 'axe' },
  { name: 'softwood', tile: 'pineTree' },
  { name: 'hardwood', tile: 'appleTree' },
  { name: 'poop' },
  { name: 'shield' },
  { name: 'bolt' },
  { name: 'knife' },
  { name: 'gear' },
  { name: 'spoon' },
  { name: 'link' },
  { name: 'pick' },
  { name: 'bicycle' },
  { name: 'hook' },
  { name: 'hammer' },
  { name: 'chain' },
  { name: 'scissors' },
  { name: 'cart' },
  { name: 'fishingRod' },
  { name: 'copper' },
  { name: 'silver' },
  { name: 'gold' },
  { name: 'apple', food: true, health: 1 },
  { name: 'pineApple', food: true, stamina: 1 },
  { name: 'canoe' },
  { name: 'dagger' },
  { name: 'doubleDagger' },
  { name: 'wrench' },
  { name: 'knittingNeedles' },
];

const tileTypes = [
  { name: 'empty', text: '' },
  { name: 'happy', text: '🙂' },
  { name: 'backpack', text: '🎒    ' },
  { name: 'back', text: '🔙' },
  { name: 'trash', text: '🗑' },
  { name: 'shield', text: '🛡    ' },
  { name: 'pineTree', text: '🌲' },
  { name: 'appleTree', text: '🌳' },
  { name: 'axe', text: '🪓   ' },
  { name: 'apple', text: '🍎 ' },
  { name: 'north', text: '👆  ' },
  { name: 'south', text: '👇  ' },
  { name: 'west', text: '👈 ' },
  { name: 'east', text: '👉 ' },
  { name: 'left', text: '✋ ' },
  { name: 'swap', text: '🤝    ' },
  { name: 'right', text: '🤚 ' },
  { name: 'watch', text: '⏱ ' },
  { name: 'back', text: '🔙     ' },
  { name: 'health', text: '❤️ ' },
  { name: 'stamina', text: '💛 ' },
  { name: 'healthSlot', text: '🖤 ' },
  { name: 'staminaSlot', text: '🖤 ' },
  { name: 'poop', text: '💩  ' },
  { name: 'bolt', text: '🔩 ' },
  { name: 'knife', text: '🔪 ' },
  { name: 'spoon', text: '🥄 ' },
  { name: 'link', text: '🔗 ' },
  { name: 'gear', text: '⚙️ ' },
  { name: 'pick', text: '⛏ ' },
  { name: 'bicycle', text: '🚲 ' },
  { name: 'hook', text: '⚓️' },
  { name: 'hammer', text: '🔨' },
  { name: 'wrench', text: '🔧' },
  { name: 'chain', text: '⛓' },
  { name: 'scissors', text: '✂️ ' },
  { name: 'hammerAndPick', text: '⚒ ' },
  { name: 'hammerAndWrench', text: '🛠' },
  { name: 'dagger', text: '🗡', turn: 2 },
  { name: 'doubleDagger', text: '⚔️'  },
  { name: 'cart', text: '🛒    ' },
  { name: 'fishingRod', text: '🎣 ' },
  { name: 'mountain', text: '⛰' },
  { name: 'copper', text: '🥉' },
  { name: 'silver', text: '🥈' },
  { name: 'gold', text: '🥇' },
  { name: 'bank', text: '🏦' },
  { name: 'forge', text: '🏭' },
  { name: 'rainbow', text: '🌈' },
  { name: 'shoe', text: '👞' },
  { name: 'one', text: '1️⃣' },
  { name: 'two', text: '2️⃣' },
  { name: 'three', text: '3️⃣' },
  { name: 'four', text: '4️⃣' },
  { name: 'five', text: '5️⃣' },
  { name: 'six', text: '6️⃣' },
  { name: 'seven', text: '7️⃣' },
  { name: 'eight', text: '8️⃣' },
  { name: 'nine', text: '9️⃣' },
  { name: 'canoe', text: '🛶' },
  { name: 'knittingNeedles', text: '🥢 ' },
];

export const tileTypesByName = Object.fromEntries(tileTypes.map((type, index) => [type.name, index]));
export const agentTypesByName = Object.fromEntries(agentTypes.map(({ name }, i) => [name, i]));
export const itemTypesByName = Object.fromEntries(itemTypes.map(({ name }, i) => [name, i]));

export const defaultTileTypeForAgentType = agentTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const tileTypeForItemType = itemTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const viewText = tileTypes.map(type => type.text);

const craftingFormulae = new Map();

/**
 * @param {string} agent
 * @param {string} reagent
 * @param {string} product
 * @param {string} byproduct
 */
function craft(agent, reagent, product, byproduct = 'empty') {
  const agentType = itemTypesByName[agent];
  const reagentType = itemTypesByName[reagent];
  const productType = itemTypesByName[product];
  const byproductType = itemTypesByName[byproduct];
  assert(agentType !== undefined);
  assert(reagentType !== undefined);
  assert(productType !== undefined);
  craftingFormulae.set(agentType * itemTypes.length + reagentType, [productType, byproductType]);
}

/**
 * @param {number} agentType
 * @param {number} reagentType
 * @returns {[number, number]} productType and byproductType
 */
export function combine(agentType, reagentType) {
  let productTypes = craftingFormulae.get(agentType * itemTypes.length + reagentType);
  if (productTypes !== undefined) {
    return productTypes;
  }
  productTypes = craftingFormulae.get(reagentType * itemTypes.length + agentType);
  if (productTypes !== undefined) {
    return productTypes;
  }
  return [itemTypesByName.poop, itemTypesByName.empty];
}

craft('bolt', 'bolt', 'knife');
craft('bolt', 'gear', 'spoon');
craft('bolt', 'link', 'wrench');

craft('gear', 'bolt', 'pick');
craft('gear', 'gear', 'bicycle');
craft('gear', 'link', 'hook');

craft('link', 'gear', 'shield');
craft('link', 'link', 'chain');

craft('bolt', 'knife', 'dagger');
craft('knife', 'knife', 'scissors');

craft('dagger', 'dagger', 'doubleDagger');

craft('spoon', 'softwood', 'canoe', 'spoon');

craft('knife', 'softwood', 'knittingNeedles');

