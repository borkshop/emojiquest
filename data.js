// @ts-check

import {assert} from './assert.js';

export const agentTypes = [
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
];

const tileTypes = [
  { name: 'happy', text: '🙂' },
  { name: 'backpack', text: '🎒    ' },
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
  { name: 'chain', text: '⛓' },
  { name: 'scissors', text: '✂️ ' },
  { name: 'hammerAndPick', text: '⚒ ' },
  { name: 'hammerAndWrench', text: '🛠' },
  { name: 'sword', text: '🗡', turn: 2 },
  { name: 'cart', text: '🛒    ' },
  { name: 'fishingRod', text: '🎣 ' },
  { name: 'mountain', text: '⛰' },
  { name: 'copper', text: '🥉' },
  { name: 'silver', text: '🥈' },
  { name: 'gold', text: '🥇' },
  { name: 'bank', text: '🏦' },
  { name: 'forge', text: '🏭' },
];

export const tileTypesByName = Object.fromEntries(tileTypes.map((type, index) => [type.name, index]));
export const agentTypesByName = Object.fromEntries(agentTypes.map(({ name }, i) => [name, i]));
export const itemTypesByName = Object.fromEntries(itemTypes.map(({ name }, i) => [name, i]));

export const defaultTileTypeForAgentType = agentTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const tileTypeForItemType = itemTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const viewText = tileTypes.map(type => type.text);

const formulae = new Map();

/**
 * @param {string} agent
 * @param {string} reagent
 * @param {string} product
 */
function formula(agent, reagent, product) {
  const agentType = itemTypesByName[agent];
  const reagentType = itemTypesByName[reagent];
  const productType = itemTypesByName[product];
  assert(agentType !== undefined);
  assert(reagentType !== undefined);
  assert(productType !== undefined);
  formulae.set(agentType * itemTypes.length + reagentType, productType);
}

/**
 * @param {number} agentType
 * @param {number} reagentType
 * @returns {number} productType
 */
export function combine(agentType, reagentType) {
  let productType = formulae.get(agentType * itemTypes.length + reagentType);
  if (productType !== undefined) {
    return productType;
  }
  productType = formulae.get(reagentType * itemTypes.length + agentType);
  if (productType !== undefined) {
    return productType;
  }
  return itemTypesByName.poop;
}

formula('bolt', 'bolt', 'knife');
