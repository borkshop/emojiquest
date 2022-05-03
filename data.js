/**
 * The data module provides the pure-data facet of the mechanics of Emoji Quest
 * including descriptions of all the entity types in the game including
 * tiles, items, effects and agents.
 *
 * The mechanics module creates indices of these data types.
 */

// @ts-check

/**
 * @type {Array<import('./mechanics.js').AgentType>}
 */
export const validAgentTypes = [
  { name: 'player', tile: 'happy' },
  { name: 'pineTree', dialog: ['🌲 Knock knock?'] },
  { name: 'appleTree', dialog: ['🌳 Knock knock?'] },
  { name: 'axe' }, // temporary
  { name: 'mountain' },
  { name: 'pick' }, // temporary
  { name: 'bank' },
  { name: 'forge' },
  { name: 'ram', wanders: 'land' },
  { name: 'ewe', wanders: 'land', dialog: ['🐑 Bah.', '🐏 Ram.', '🐑 Ewe.'] },
  { name: 'coat' }, // temporary
  { name: 'castle', dialog: [
    '👸 Behold, stranger. I am *Princess Die* of *Euia*.',
    '👸 The power of *mojick*, the transmutation of *emoji*, has faded from the land…',
    '👸 With it, all the *mojical creatures* have vanished…',
    '👸 The 🦄*unicorn* has not been seen since *The Fall*…',
    '👸 The 🐉*dragon* is but a myth. 🔚',
  ] },
];

/**
 * @type {Array<import('./mechanics.js').ItemType>}
 */
export const validItemTypes = [
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
  { name: 'apple', comestible: true },
  { name: 'pineApple', comestible: true },
  { name: 'canoe' },
  { name: 'dagger' },
  { name: 'doubleDagger' },
  { name: 'wrench' },
  { name: 'knittingNeedles' },
  { name: 'basket', tile: 'trash' },
  { name: 'meat' },
  { name: 'yarn' },
  { name: 'hammerAndPick' },
  { name: 'hammerAndWrench' },
  { name: 'coat', effect: 'warm' },
];

/**
 * @type {Array<import('./mechanics.js').TileType>}
 */
export const tileTypes = [
  { name: 'invalid', text: '�' },
  { name: 'empty', text: '' },
  { name: 'any', text: '*' },
  { name: 'happy', text: '🙂' },
  { name: 'backpack', text: '🎒    ' },
  { name: 'back', text: '🔙' },
  { name: 'trash', text: '🗑' },
  { name: 'mouth', text: '👄' },
  { name: 'shield', text: '🛡    ' },
  { name: 'pineTree', text: '🌲' },
  { name: 'appleTree', text: '🌳' },
  { name: 'axe', text: '🪓   ' },
  { name: 'apple', text: '🍎 ' },
  { name: 'pineApple', text: '🍍' },
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
  { name: 'paint', text: '🖌' },
  { name: 'gemini', text: '♊️' },
  { name: 'twin', text: '👯‍♂️' },
  { name: 'hammerAndPick', text: '⚒ ' },
  { name: 'hammerAndWrench', text: '🛠' },
  { name: 'dagger', text: '🗡', turn: 2 },
  { name: 'doubleDagger', text: '⚔️' },
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
  { name: 'yarn', text: '🧶 ' },
  { name: 'thread', text: '🧵' },
  { name: 'wind', text: '💨' },
  { name: 'waterDroplet', text: '💧 ' },
  { name: 'fire', text: '🔥' },
  { name: 'rainbow', text: '🌈 ' },
  { name: 'ewe', text: '🐑 ' },
  { name: 'ram', text: '🐏 ' },
  { name: 'meat', text: '🥩' },
  { name: 'coat', text: '🧥' },
  { name: 'balloon', text: '🎈 ' },
  { name: 'arm', text: '💪 ' },
  { name: 'shirt', text: '👕' },
  { name: 'hamburger', text: '🍔 ' },
  { name: 'thumbUp', text: '👍' },
  { name: 'castle', text: '🏰 ' },
];

/**
 * @type {Array<import('./mechanics.js').Recipe>}
 */
export const recipes = [
  // metallurgy 1
  { agent: 'bolt', reagent: 'bolt', product: 'knife', price: 4 },
  { agent: 'bolt', reagent: 'gear', product: 'spoon', price: 5 },
  { agent: 'bolt', reagent: 'link', product: 'wrench', price: 3 },
  { agent: 'gear', reagent: 'bolt', product: 'pick', price: 5 },
  { agent: 'gear', reagent: 'gear', product: 'bicycle', price: 6 },
  { agent: 'gear', reagent: 'link', product: 'hook', price: 4 },
  { agent: 'link', reagent: 'gear', product: 'shield', price: 4 },
  { agent: 'link', reagent: 'bolt', product: 'hammer', price: 3 },
  { agent: 'link', reagent: 'link', product: 'chain', price: 2 },

  // metallurgy 2
  { agent: 'knife', reagent: 'knife', product: 'scissors', price: 8 },
  { agent: 'bolt', reagent: 'knife', product: 'dagger', price: 6 },
  { agent: 'hammer', reagent: 'knife', product: 'axe', price: 7 },
  { agent: 'hammer', reagent: 'pick', product: 'hammerAndPick', price: 8 },
  { agent: 'hammer', reagent: 'wrench', product: 'hammerAndWrench', price: 6 },
  { agent: 'gear', reagent: 'chain', product: 'basket', price: 5 },

  // composite 2
  { agent: 'spoon', reagent: 'softwood', product: 'canoe', byproduct: 'spoon' },
  {
    agent: 'knife',
    reagent: 'softwood',
    product: 'knittingNeedles',
    byproduct: 'knife',
  },
  { agent: 'hook', reagent: 'softwood', product: 'fishingRod' },

  // metallurgy 3
  { agent: 'bicycle', reagent: 'basket', product: 'cart' },
  { agent: 'dagger', reagent: 'dagger', product: 'doubleDagger' },

  // composite 3
  {
    agent: 'knittingNeedles',
    reagent: 'yarn',
    product: 'coat',
    byproduct: 'knittingNeedles',
  },
];

/**
 * @type {Array<import('./mechanics.js').Action>}
 */
export const actions = [
  // raw material
  { patient: 'axe', verb: 'take', items: ['axe'] },
  { patient: 'coat', verb: 'take', items: ['coat'] },
  { patient: 'pineTree', left: 'axe', verb: 'reap', items: ['softwood'] },
  { patient: 'appleTree', left: 'axe', verb: 'reap', items: ['hardwood'] },
  { patient: 'pick', right: 'any', verb: 'take', items: ['pick'] },
  { patient: 'mountain', left: 'pick', verb: 'cut', items: ['copper'] },
  { patient: 'ewe', left: 'scissors', verb: 'cut', items: ['yarn'] },
  { patient: 'ewe', left: 'knife', verb: 'reap', items: ['meat'] },
  { patient: 'ram', left: 'scissors', verb: 'cut', items: ['yarn'] },
  { patient: 'ram', left: 'knife', verb: 'reap', items: ['meat'] },
  {
    patient: 'appleTree',
    right: 'any',
    verb: 'pick',
    items: ['apple'],
    dialog: '🍎  Apple?',
  },
  { patient: 'pineTree', right: 'any', verb: 'pick', items: ['pineApple'] },
  // monetary exchange
  {
    patient: 'bank',
    left: 'copper',
    right: 'copper',
    verb: 'merge',
    items: ['silver'],
  },
  {
    patient: 'bank',
    left: 'silver',
    right: 'copper',
    verb: 'merge',
    items: ['gold'],
  },
  {
    patient: 'bank',
    left: 'copper',
    right: 'silver',
    verb: 'merge',
    items: ['gold'],
  },
  {
    patient: 'bank',
    left: 'silver',
    verb: 'split',
    items: ['copper', 'copper'],
  },
  {
    patient: 'bank',
    right: 'silver',
    verb: 'split',
    items: ['copper', 'copper'],
  },
  { patient: 'bank', left: 'gold', verb: 'split', items: ['silver', 'copper'] },
  {
    patient: 'bank',
    right: 'gold',
    verb: 'split',
    items: ['silver', 'copper'],
  },
  // forgery
  {
    patient: 'forge',
    left: 'copper',
    right: 'any',
    verb: 'replace',
    items: ['link'],
  },
  {
    patient: 'forge',
    left: 'silver',
    right: 'any',
    verb: 'replace',
    items: ['bolt'],
  },
  {
    patient: 'forge',
    left: 'gold',
    right: 'any',
    verb: 'replace',
    items: ['gear'],
  },
];

/** @type {Array<import('./mechanics.js').EffectType>} */
export const effectTypes = [
  { name: 'warm', tile: 'coat' }, // 1
  { name: 'fire' }, // 2
  { name: 'float', tile: 'canoe' }, // 3
  { name: 'power', tile: 'lightningBolt' }, // 4
  { name: 'mojick', tile: 'rainbow' }, // 5
  { name: 'water', tile: 'waterDroplet' }, // 6
  { name: 'fly', tile: 'balloon' }, // 7
  { name: 'wind', tile: 'wind' }, // 8
  { name: 'none', tile: 'shirt' }, // 9
  { name: 'any' },
];
