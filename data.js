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
  { name: 'player', tile: 'happy', health: 3, stamina: 3 },
  {
    name: 'pineTree',
    dialog: [
      '🌲 Knock knock.',
      '🙂 Who’s there?',
      '🦉 Hoo.',
      '🤔 Hoo who?',
      '🦉 Hoo hoo hoo!',
      '😩 Hoo hoo hoo who?',
      '🦉 Hoo let the <b>🐕 dogs 🐩</b> out! 🔚',
    ],
  },
  { name: 'appleTree', dialog: ['🌳 Knock knock?'] },
  { name: 'axe' }, // temporary
  { name: 'mountain' },
  { name: 'pick' }, // temporary
  {
    name: 'bank',
    dialog: [
      '👨‍💼 Welcome to the <b>🏦 River Bank</b>…',
      '👨‍💼 While you’re here, we can exchange <b>🥉🥈🥇precious</b> <b>medals</b>…',
      '🥉🥉🔜🥈',
      '🥈🥉🔜🥇',
      '🥇🔜🥈🥉',
      '🥇🔜🥈🥉',
      '👨‍💼 Visit the main branch of <b>🏦 Bank of Dysia</b> on the far side of the <b>🎲 world</b>. 🔚',
    ],
  },
  {
    name: 'forge',
    dialog: [
      '👩‍🏭	Hello, I’m <b>Mrs. Smith</b>…',
      '👨‍🏭	And I’m <b>Mr. Smith</b>…',
      '👩‍🏭	This is a <b>forge</b> where we do honest <b>forgery</b>…',
      '👨‍🏭	Here you can smelt <b>🥇🥈🥉precious</b> <b>medals</b>…',
      '👩‍🏭	Place a medal in the forge to craft a useful component…',
      '🥉 🔜  🔗  ',
      '🥈 🔜  🔩  ',
      '🥇 🔜  ⚙️   ',
      '👨‍🏭	Components can be combined to make other components…',
      '🔗 / 🔗 🔜 ⛓ ',
      '🔗 / 🔩 🔜 🔨 ',
      '🔗 / ⚙️  🔜 🛡 ',
      '🔩 / 🔗 🔜 🔧 ',
      '🔩 / 🔩 🔜 🔪 ',
      '🔩 / ⚙️  🔜 🥄 ',
      '⚙️  / 🔗 🔜 ⚓️ ',
      '⚙️  / 🔩 🔜 ⛏ ',
      '⚙️  / ⚙️  🔜 🚲 ',
      '🔪 / 🔪 🔜 ✂️  ',
      '🔩 / 🔪 🔜 🗡 ',
      '🔨 / 🔪 🔜 🪓 ',
      '🔨 / 🔧 🔜 🛠 ',
      '⚙️  / ⛓ 🔜 🗑 ',
    ],
  },
  {
    name: 'ram',
    wanders: 'land',
    dialog: ['🐏   Ram.', '🐑   Ewe.', '🐏    Bah.'],
  },
  {
    name: 'ewe',
    wanders: 'land',
    dialog: ['🐑   Bah.', '🐏   Ram.', '🐑    Ewe.'],
  },
  { name: 'coat' }, // temporary
  {
    name: 'castle',
    dialog: [
      '👸 Behold, stranger. I am <b>Princess Die</b> of <b>Euia</b>.',
      '👸 The power of <b>mojick</b>—the transmutation of <b>emoji</b>—has faded from the land…',
      '👸 With it, all the <b>mojical creatures</b> have vanished…',
      '👸 The <b>🦄 unicorn</b> has not been seen since <b>The Fall</b>…',
      '👸 The <b>🐉 dragon</b> is but a myth. 🔚',
    ],
  },
  {
    name: 'pearTree',
    tile: 'appleTree',
    dialog: [
      '🌳 I am the <b>Tree of Knotty and Nice</b>…',
      '🌳 Just as <b>knotty</b> opposes <b>nice</b>…',
      '🌳 My fruit comes in 🍐*pears*. 🔚 ',
    ],
  },
  {
    name: 'captain',
    dialog: [
      '💂‍♂️ Hark! I’m the <b>Captain of the Guard</b>…',
      '💂‍♂️ In the forest to the <b>👈 west</b>, there is a <b>🌳 tree</b> that is quite unlike the others…',
      '💂‍♂️ Soldiers use its 🍐<b>fruit</b> to improve their <b>💛 stamina</b> when they travel in the <b>⛰ Eural</b> <b>Mountains</b>. 🔚',
    ],
  },
  {
    name: 'major',
    dialog: [
      '💂‍♀️ Hark! I’m <b>A♯ Major</b> in service to her Majesty <b>👸 Princess Die</b>…',
      '💂‍♀️ A <b>friend of mine⛏</b> has gone missing in the <b>⛰ Eural</b> <b>Mountains</b>, to the <b>👇 south</b>…',
      '💂‍♀️ They went searching for <b>🥉 precious</b> <b>medals</b>…',
      '💂‍♀️ Please help them if you can! 🔚',
    ],
  },
  {
    name: 'harriet',
    dialog: [
      '💇‍♀️ Did you know that you can shear <b>🐑 sheep</b> with <b>✂️  scissors</b>?',
      '💇‍♀️ That’s why scissors are an improvement over just <b>🔪 two knives</b>. 🔚 ',
    ],
  },
  {
    name: 'miner',
    dialog: [
      '👨‍🔧 Oy! I’m <b>A♭ miner</b>…',
      '👨‍🔧 I came here with my sturdy <b>⛏ pick axe</b> but I was trapped by this <b>🪨 boulder</b>…',
      '👨‍🔧 Theres’s ore in <b>👇 these</b> <b>⛰ mountains</b>…',
      '👨‍🔧 One can make a <b>🥉 fortune!</b> 🔚',
    ],
  },
  {
    name: 'boulder',
    dialog: [
      '🪨 Hi, you can call me <b>Rocky</b>…',
      '🪨 My mother was <b>Moraine</b>…',
      '🪨 I have many mortal enemies…',
      '🪨 I crush <b>✂️  scissors</b>…',
      '🪨 But, for reasons that escape me…',
      '🪨 I am helpless against <b>📄 paper</b>. 🔚',
    ],
  },
  {
    name: 'jack',
    dialog: [
      '🧓    Hello, I’m <b>Jack</b>…',
      '🧓    It’s hard to stay warm in the <b>❄️  frigid north</b>…',
      '🧓    That’s why I knit myself a <b>🧥 jacket</b>…',
      '🧓    To knit, you’ll need <b>🧶 yarn</b> and <b>🥢 needles</b>…',
      '🧓    I <b>🔪 whittled</b> my needles out of <b>🌲🪵 soft wood</b>.',
    ],
  },
  {
    name: 'glub',
    tile: 'fish',
    dialog: [
      '🐟    You are not a fish…',
      '🐟    Fish do not need <b>🛶 canoes</b>…',
      '🐟    Fish can swim over the <b>edge of the world</b>…',
      '🐟    Canoes are made from <b>🌲🪵 soft wood</b>…',
      '🐟    I have seen <b>you people</b> make them with <b>🥄 shovels</b>. 🔚',
    ],
  },
  {
    name: 'owl',
    dialog: [
      '🦉  If the world were candy 🍭…',
      '🦉  Hoo many licks would it take to get to the center?…',
      '🦉  I hear there’s a <b>snak</b>.',
    ],
  },
  {
    name: 'northPole',
    dialog: [
      '🎅	Ho, ho, ho. I’m <b>Magus</b>…',
      '🤶	Hee, hee. I’m <b>Maggie</b>…',
      '🎅	We were once the powerful <b>Moji</b> of the north…',
      '🤶	We watched over everything, <b>Knotty</b> <i>and</i> <b>Nice</b>…',
      '🎅	We were the stewards of the <b>💨 Essence</b> <b>of Wind</b>…',
      '🤶	We seek a student to pass on our knowledge…',
      '🎅	They must construct for us an <b>🌂 umbrella</b>…',
      '🤶	We swear it’s relevant. 🔚',
    ],
  },
  {
    name: 'clover',
  },
  {
    name: 'warning',
    dialog: [
      '⚠️  No fowl play',
      '⚠️  Nor egrets',
      '⚠️  No good tern',
      '⚠️  Goose unpunished',
      '<b>🐧 The</b> <b>Management</b>',
    ],
  },
  {
    name: 'bee',
    dialog: [
      // '🐝 State your bizzness!…',
      '🐝 I am a <b>bumblebee</b>…',
      '🐝 Long ago, I was called a <b>dumbledore</b>…',
      '🐝 I wove words in my <b>⦙beeline⦙</b>',
      '🐝 I taught <b>mojick spelling</b>…',
      '🐝 I could spell in 𝓬𝓾𝓻𝓼𝓲𝓿𝓮!',
      '🐝 I could spell in 𝓫𝓵𝓮𝓼𝓼𝓲𝓿𝓮!',
    ],
  },
];

/**
 * @type {Array<import('./mechanics.js').ItemType>}
 */
export const validItemTypes = [
  {
    name: 'axe',
    tip: '🪓 Did you know that <b>axe</b>, <b>acid</b>, and <b>oxygen</b> are all related words?',
  },
  { name: 'softwood', tile: 'log', tip: '🌲🪵 The lumber of a softwood.' },
  { name: 'hardwood', tile: 'log', tip: '🌳🪵 The lumber of a hardwood.' },
  { name: 'poop', tip: '💩 Everyone poops!' },
  {
    name: 'shield',
    tip: '🛡 A sheet of metal <b>can</b> serve many functions.',
  },
  {
    name: 'bolt',
    tip: '🔩 Bolts pair well with <b>⚙️  gears</b> <b>🔗 links</b>.',
  },
  { name: 'knife', tip: '🔪 It slices. It dices.' },
  {
    name: 'gear',
    tip: '⚙️  Gears pair well with  <b>🔗 links</b> and <b>🔩 bolts</b>.',
  },
  {
    name: 'spoon',
    tip: '🥄 A spoon will have to suffice if you can’t find a shovel emoji.',
  },
  {
    name: 'link',
    tip: '🔗 Links pair well with <b>🔩 bolts</b> and <b>⚙️  gears</b>.',
  },
  { name: 'pick', tip: '⛏ Pick your battles wisely.' },
  { name: 'bicycle', tip: '🚲 The word you’re looking for is <b>cyclist</b>.' },
  { name: 'hook', tip: '🪝 Was going to be ⚓️ before hook emoji appeared.' },
  { name: 'hammer', tip: '🔨 It’s time.' },
  { name: 'chain', tip: '⛓ Follows the links.' },
  { name: 'scissors', tip: '✂️ Cut it out.' },
  { name: 'cart', tip: '🛒 Everything <b>and</b> the kitchen sink™.' },
  { name: 'fishingRod', tip: '🎣   Not just a dull side quest™.' },
  { name: 'copper', tip: '🥉 Copper is the least precious medal.' },
  { name: 'silver', tip: '🥈 Silver is a more precious medal.' },
  { name: 'gold', tip: '🥇 Gold is the most precious medal.' },
  {
    name: 'apple',
    comestible: true,
    health: 1,
    tip: '🍎 A delicious red apple.',
  },
  {
    name: 'pineApple',
    comestible: true,
    health: 2,
    tip: '🍍 A delicious <b>🌲 pine</b> <b>🍎 apple</b>.',
  },
  { name: 'canoe', effect: 'float', tip: '🛶 Row, row, row your boat.' },
  { name: 'dagger', tip: '🗡 It’s called dagger emoji.' },
  { name: 'doubleDagger', tip: '⚔️  Dual wield or duel wield?' },
  { name: 'wrench', tip: '🔧 To turn, to twist, to spindle.' },
  {
    name: 'knittingNeedles',
    tip: '🥢 There is no emoji for knitting needles.',
  },
  {
    name: 'basket',
    tile: 'trash',
    tip: '🗑 Sometimes called the <b>round file</b>.',
  },
  { name: 'meat', tip: '🍖 We meat again.' },
  { name: 'yarn', tip: '🧶 Tell a yarn. Spin a tale.' },
  {
    name: 'hammerAndPick',
    tip: '⚒️  Why <b>⛏pick</b> when you can also <b>🔨 hammer</b>.',
  },
  { name: 'hammerAndWrench', tip: '🛠 Smash <b>and</b> grab.' },
  {
    name: 'coat',
    effect: 'warm',
    tip: '🧥 It’s a coat! It’s a jacket! No, it’s <b>super warm</b>!',
  },
  {
    name: 'pear',
    comestible: true,
    stamina: 1,
    tip: '🍐 Apples sometimes come in pears.',
  },
  {
    name: 'clover',
    tip: '☘️  One leaf shy of lucky.',
  },
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
  { name: 'left', text: '🫲   ', turn: 2 },
  { name: 'swap', text: '🤝    ' },
  { name: 'right', text: '🫱   ', turn: 6 },
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
  { name: 'link', text: '🔗   ' },
  { name: 'gear', text: '⚙️   ' },
  { name: 'pick', text: '⛏ ' },
  { name: 'bicycle', text: '🚲 ' },
  { name: 'hook', text: '🪝' },
  { name: 'hammer', text: '🔨' },
  { name: 'wrench', text: '🔧' },
  { name: 'chain', text: '⛓' },
  { name: 'scissors', text: '✂️ ', turn: 4 },
  { name: 'paint', text: '🖌' },
  { name: 'gemini', text: '♊️' },
  { name: 'twin', text: '👯‍♂️' },
  { name: 'hammerAndPick', text: '⚒ ' },
  { name: 'hammerAndWrench', text: '🛠' },
  { name: 'dagger', text: '🗡', turn: 3 },
  { name: 'doubleDagger', text: '⚔️' },
  { name: 'cart', text: '🛒      ' },
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
  { name: 'captain', text: '💂‍♂️  ' },
  { name: 'major', text: '💂‍♀️' },
  { name: 'pear', text: '🍐 ' },
  { name: 'miner', text: '👨‍🔧   ' },
  { name: 'harriet', text: '🏠   ' },
  { name: 'boulder', text: '🪨     ' },
  { name: 'jack', text: '🏡    ' },
  { name: 'fish', text: '🐟    ' },
  { name: 'owl', text: '🦉   ' },
  { name: 'log', text: '🪵 ' },
  { name: 'northPole', text: '💈    ' },
  { name: 'clover', text: '☘️    ' },
  { name: 'fleurDeLis', text: '⚜️   ' },
  { name: 'trident', text: '🔱     ' },
  { name: 'warning', text: '🚧     ' },
  { name: 'bee', text: '🐝     ' },
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
  {
    agent: 'axe',
    reagent: 'softwood',
    product: 'knittingNeedles',
    byproduct: 'axe',
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

  // A joke that breaks the game a little.
  {
    agent: 'apple',
    reagent: 'apple',
    product: 'pear',
    dialog: 'Now you have a <b>🍐 pear</b> of <b>🍎 apples</b>!',
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
  {
    patient: 'pearTree',
    right: 'any',
    verb: 'pick',
    items: ['pear'],
    dialog: '🍐 The fruit of the <b>🌳 world tree</b> comes in pears',
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
  { patient: 'boulder', verb: 'pick', items: ['pick'] },
  {
    patient: 'clover',
    right: 'any',
    verb: 'pick',
    items: ['clover'],
  },
];

// TODO 🪨rock, 📄paper, ✂️scissors, 🦎lizard, 🖖spock

/** @type {Array<import('./mechanics.js').EffectType>} */
export const validEffectTypes = [];
