// @ts-check

/**
 * @type {Array<{
 *   name: string,
 *   tile?: string,
 *   wanders?: string,
 * }>}
 */
export const agentTypes = [
  { name: 'invalid' },
  { name: 'empty' },
  { name: 'any' },
  { name: 'player', tile: 'happy' },
  { name: 'pineTree' },
  { name: 'appleTree' },
  { name: 'axe' },
  { name: 'mountain' },
  { name: 'pick' },
  { name: 'bank' },
  { name: 'forge' },
  { name: 'ram', wanders: 'land' },
  { name: 'ewe', wanders: 'land' },
];


/**
 * @type {Array<{
 *   name: string,
 *   tile?: string,
 *   comestible?: boolean,
 * }>}
 */
export const itemTypes = [
  { name: 'invalid' },
  { name: 'empty' },
  { name: 'any' },
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
  { name: 'coat' },
];

/**
 * @type {Array<{
 *   name: string,
 *   text: string,
 *   turn?: number,
 * }>}
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
];

/**
 * @type {Array<[
 *   agent: string,
 *   reagent: string,
 *   product: string,
 *   byproduct?: string,
 * ]>}
 */
export const recipes = [

  // metallurgy 1
  ['bolt', 'bolt', 'knife'],
  ['bolt', 'gear', 'spoon'],
  ['bolt', 'link', 'wrench'],
  ['gear', 'bolt', 'pick'],
  ['gear', 'gear', 'bicycle'],
  ['gear', 'link', 'hook'],
  ['link', 'gear', 'shield'],
  ['link', 'bolt', 'hammer'],
  ['link', 'link', 'chain'],

  // metallurgy 2

  ['knife', 'knife', 'scissors'],
  ['bolt', 'knife', 'dagger'],
  ['hammer', 'pick', 'hammerAndPick'],
  ['hammer', 'wrench', 'hammerAndWrench'],
  ['gear', 'chain', 'basket'],

  // composite 2

  ['spoon', 'softwood', 'canoe', 'spoon'],
  ['knife', 'softwood', 'knittingNeedles', 'knife'],
  ['hook', 'softwood', 'fishingRod'],

  // metallurgy 3

  ['bicycle', 'basket', 'cart'],
  ['dagger', 'dagger', 'doubleDagger'],

  // composite 3

  ['knittingNeedles', 'yarn', 'coat', 'knittingNeedles'],

];

/**
 * @typedef {[
 *   agent: string,
 *   patient: string,
 *   left: string,
 *   right: string,
 *   effect: string,
 *   verb: string,
 *   object: Array<string>,
 * ]} Action
 */

/**
 * @type {Array<Action>}
 */
export const actions = [
  // raw material
  ['player', 'axe', 'empty', 'empty', 'any', 'take', ['axe']],
  ['player', 'pineTree', 'axe', 'empty', 'any', 'reap', ['softwood']],
  ['player', 'appleTree', 'axe', 'empty', 'any', 'reap', ['hardwood']],
  ['player', 'pick', 'empty', 'any', 'any', 'take', ['pick']],
  ['player', 'mountain', 'pick', 'empty', 'any', 'cut', ['copper']],
  ['player', 'ewe', 'scissors', 'empty', 'any', 'cut', ['yarn']],
  ['player', 'ewe', 'knife', 'empty', 'any', 'reap', ['meat']],
  ['player', 'ram', 'scissors', 'empty', 'any', 'cut', ['yarn']],
  ['player', 'ram', 'knife', 'empty', 'any', 'reap', ['meat']],
  ['player', 'appleTree', 'empty', 'any', 'any', 'pick', ['apple']],
  ['player', 'pineTree', 'empty', 'any', 'any', 'pick', ['pineApple']],

  // monetary exchange
  ['player', 'bank', 'copper', 'copper', 'any', 'merge', ['silver']],
  ['player', 'bank', 'silver', 'copper', 'any', 'merge', ['gold']],
  ['player', 'bank', 'copper', 'silver', 'any', 'merge', ['gold']],
  ['player', 'bank', 'silver', 'empty', 'any', 'split', ['copper', 'copper']],
  ['player', 'bank', 'empty', 'silver', 'any', 'split', ['copper', 'copper']],
  ['player', 'bank', 'gold', 'empty', 'any', 'split', ['silver', 'copper']],
  ['player', 'bank', 'empty', 'gold', 'any', 'split', ['silver', 'copper']],

  // forgery
  ['player', 'forge', 'copper', 'any', 'any', 'replace', ['link']],
  ['player', 'forge', 'silver', 'any', 'any', 'replace', ['bolt']],
  ['player', 'forge', 'gold', 'any', 'any', 'replace', ['gear']],
];

/** @type {Array<{
 *   name: string,
 *   tile?: string,
 * }>} */
export const effectTypes = [
  { name: 'invalid' },
  { name: 'empty' },
  { name: 'any' },
  { name: 'wind', tile: 'wind' },
  { name: 'water', tile: 'waterDroplet' },
  { name: 'fire'  },
  { name: 'power', tile: 'lightningBolt' },
  { name: 'mojick', tile: 'rainbow' },
];
