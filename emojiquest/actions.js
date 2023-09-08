/** @param {import('../mechanics.js').ActionDescription} action */
const ambi = ({ left, right, ...rest }) => [
  { left, right, ...rest },
  { left: right, right: left, ...rest },
];

/**
 * Actions are not _yet_ captured by index in game state, but may need to be
 * for journaling or achievements.
 *
 * @type {Array<import('../mechanics.js').ActionDescription>}
 */
export const actions = [
  // debug
  {
    patient: 'gift',
    left: 'empty',
    right: 'empty',
    items: ['wetOpenUmbrella', 'coat'],
    verb: 'cut',
    dialog: '🎁 It is dangerous to go alone. Take this!',
  },
  {
    patient: 'gift2',
    left: 'empty',
    right: 'empty',
    items: ['scissors', 'spoon'],
    verb: 'cut',
    dialog: '🎁 It is dangerous to go alone. Take this!',
  },
  {
    patient: 'axe',
    left: 'empty',
    right: 'any',
    verb: 'take',
    items: ['axe'],
    dialog: '🪓 You get an axe.',
  },
  // Temporary
  {
    patient: 'coat',
    left: 'empty',
    right: 'any',
    verb: 'take',
    items: ['coat'],
  },
  // Temporary
  {
    patient: 'swimBriefs',
    left: 'empty',
    right: 'any',
    verb: 'take',
    items: ['swimBriefs'],
  },
  {
    patient: 'pineTree',
    left: 'axe',
    right: 'empty',
    verb: 'reap',
    items: ['wood'],
    dialog: '🌲🪓🔜🪵 You chop down a pine tree.',
  },
  {
    patient: 'appleTree',
    left: 'axe',
    right: 'empty',
    verb: 'reap',
    items: ['wood'],
    dialog: '🌳🪓🔜🪵 You chop down an apple tree.',
  },
  {
    patient: 'pick',
    left: 'empty',
    right: 'any',
    verb: 'take',
    items: ['pick'],
    dialog: '⛏ Got pick?',
  },

  // Clued by major and miner:
  {
    patient: 'mountain',
    left: 'pick',
    right: 'empty',
    verb: 'cut',
    items: ['copper'],
    dialog: '⛰⛏🔜🥉 You win copper!',
  },

  // Clued by harriet:
  {
    patient: 'ewe',
    left: 'scissors',
    right: 'empty',
    verb: 'cut',
    items: ['yarn'],
    dialog: '🐑✂️🔜🧶 Wool becomes ewe?',
  },
  // Clued by harriet:
  {
    patient: 'ram',
    left: 'scissors',
    right: 'empty',
    verb: 'cut',
    items: ['yarn'],
    dialog: '🐏✂️🔜🧶 Shear audacity!',
  },

  // TODO Not in quest line
  // TODO Not clued
  {
    patient: 'ewe',
    left: 'knife',
    right: 'empty',
    verb: 'reap',
    items: ['meat'],
    dialog: '🐑🔪🔜🥩 Was this a Miss Steak?',
  },
  {
    patient: 'ram',
    left: 'knife',
    right: 'empty',
    verb: 'reap',
    items: ['meat'],
    dialog: '🐏🔪🔜🥩 Meat your maker!',
  },

  {
    patient: 'appleTree',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['apple'],
    dialog: '🍎  Apple?',
  },

  // Clue deliberately omitted.
  // This is a cheat for the captain's stamina quest.
  {
    patient: 'pearTree',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['pear'],
    dialog: '🍐 The fruit of the <b>🌳 world tree</b> comes in pears',
  },

  {
    patient: 'pineTree',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['pineApple'],
    dialog: '🍍 Got <i>pine</i> apple. ',
  },

  {
    patient: 'palmTree',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['date'],
    dialog: '📆 Got a date.',
  },
  {
    patient: 'palmIsland',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['banana'],
    dialog: '📆 Got a date.',
  },

  // Monetary exchange
  {
    patient: 'bank',
    left: 'copper',
    right: 'copper',
    verb: 'merge',
    items: ['silver'],
    dialog: '🥉🥉🔜🥈 Traded copper up.',
  },
  {
    patient: 'bank',
    left: 'silver',
    right: 'copper',
    verb: 'merge',
    items: ['gold'],
    dialog: '🥈🥉🔜🥇 I love gold!',
  },
  {
    patient: 'bank',
    left: 'copper',
    right: 'silver',
    verb: 'merge',
    items: ['gold'],
    dialog: '🥉🥈🔜🥇 Gold, I love!',
  },
  {
    patient: 'bank',
    left: 'silver',
    right: 'empty',
    verb: 'split',
    items: ['copper', 'copper'],
    dialog: '🥈🔜🥉🥉 A bird in hand is worth two in the bush.',
  },
  {
    patient: 'bank',
    left: 'gold',
    right: 'empty',
    verb: 'split',
    items: ['silver', 'copper'],
    dialog: '🥇🔜🥈🥉 Don’t spend it all in one place.',
  },
  {
    patient: 'bank',
    left: 'silver',
    right: 'silver',
    verb: 'replace',
    items: ['gold', 'copper'],
    dialog: '🥈🥈🔜🥇🥉 Large and small.',
  },
  {
    patient: 'bank',
    left: 'gold',
    right: 'copper',
    verb: 'replace',
    items: ['silver', 'silver'],
    dialog: '🥇🥉🔜🥈🥈 Spread evenly.',
  },
  {
    patient: 'bank',
    left: 'copper',
    right: 'gold',
    verb: 'replace',
    items: ['silver', 'silver'],
    dialog: '🥉🥇🔜🥈🥈 Evenly spread.',
  },

  // Loan shark exchange
  {
    patient: 'shark',
    left: 'copper',
    right: 'copper',
    verb: 'merge',
    items: ['silver'],
    dialog: '🥉🥉🔜🥈 Such silver!',
  },
  {
    patient: 'shark',
    left: 'silver',
    right: 'copper',
    verb: 'merge',
    items: ['gold'],
    dialog: '🥈🥉🔜🥇 Have gold!',
  },
  {
    patient: 'shark',
    left: 'copper',
    right: 'silver',
    verb: 'merge',
    items: ['gold'],
    dialog: '🥉🥈🔜🥇 Have gold!',
  },
  {
    patient: 'shark',
    left: 'silver',
    right: 'empty',
    verb: 'split',
    items: ['copper', 'copper'],
    dialog: '🥈🔜🥉🥉 A fish in jaws is worth two in the coral.',
  },
  {
    patient: 'shark',
    left: 'gold',
    right: 'empty',
    verb: 'split',
    items: ['silver', 'copper'],
    dialog: '🥇🔜🥈🥉 Divide and conquer.',
  },

  // Forgery
  {
    patient: 'forge',
    left: 'copper',
    right: 'any',
    verb: 'replace',
    items: ['link'],
    dialog: '🔗 Link awakened.',
  },
  {
    patient: 'forge',
    left: 'silver',
    right: 'any',
    verb: 'replace',
    items: ['bolt'],
    dialog: '🔩 Forged a bolt.',
  },
  {
    patient: 'forge',
    left: 'gold',
    right: 'any',
    verb: 'replace',
    items: ['gear'],
    dialog: '⚙️  Gear made.',
  },
  ...ambi({
    patient: 'forge',
    left: 'clover',
    right: 'gold',
    verb: 'merge',
    items: ['trident'],
    dialog:
      'The <b>🥇 gilded</b> <b>☘️ clover</b> makes a <b>🔱 trident</b>, the <b>wand of water</b>!',
  }),

  // Recycling
  {
    patient: 'recyclingPlant',
    left: 'link',
    right: 'any',
    verb: 'replace',
    items: ['copper'],
    dialog: '🔗🔜🥉 Recovered some copper!',
  },
  {
    patient: 'recyclingPlant',
    left: 'bolt',
    right: 'any',
    verb: 'replace',
    items: ['silver'],
    dialog: '🔩🔜🥈 Recovered some silver!',
  },
  {
    patient: 'recyclingPlant',
    left: 'gear',
    right: 'any',
    verb: 'replace',
    items: ['gold'],
    dialog: '⚙️🔜🥇 Recovered some gold!',
  },
  {
    patient: 'recyclingPlant',
    left: 'axe', // knife + hammer = (2 + 2) + (2 + 1) = 7
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'gold'], // yields 3 + 3 = 6
    dialog: '🪓🔜🥇🥇 Best we could do!',
  },
  {
    patient: 'recyclingPlant',
    left: 'spoon',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'silver'],
    dialog: '🥄🔜🥇🥈 Recovered <b>medals</b>!',
  },
  {
    patient: 'recyclingPlant',
    left: 'hammer',
    right: 'any',
    verb: 'replace',
    items: ['gold'],
    dialog: '🥄🔜🥇🥈 Recovered <b>medals</b>!',
  },
  {
    patient: 'recyclingPlant',
    left: 'knife',
    right: 'empty',
    verb: 'replace',
    items: ['silver', 'silver'],
    dialog: '🔪🔜🥈🥈 Recovered <b>medals</b>!',
  },
  {
    patient: 'recyclingPlant',
    left: 'scissors', // (2 + 2) + (2 + 2) = 8
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'gold'], // 3 + 3 = 6
    dialog: '✂️🔜🥇🥇 Some <b>constituents</b> were lost 😞.',
  },
  {
    patient: 'recyclingPlant',
    left: 'bicycle',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'gold'],
    dialog: '🚲🔜🥇🥇 Recovered <b>medals</b>!.',
  },
  {
    patient: 'recyclingPlant',
    left: 'hook',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'copper'],
    dialog: '🪝🔜🥇🥉 Recovered <b>medals</b>!.',
  },
  {
    patient: 'recyclingPlant',
    left: 'shield',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'copper'],
    dialog: '🛡🔜🥇🥉 Recovered <b>medals</b>!.',
  },
  {
    patient: 'recyclingPlant',
    left: 'dagger', // bolt + knife = 3 bolt = 3 * 2 = 6
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'gold'],
    dialog: '🗡🔜🥇🥇 Recovered <b>medals</b>!.',
  },
  {
    patient: 'recyclingPlant',
    left: 'bin',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'silver'],
    dialog: '🗑🔜🥇🥈 Recovered <b>medals</b>!.',
  },
  {
    patient: 'recyclingPlant',
    left: 'pick',
    right: 'empty',
    verb: 'replace',
    items: ['gold', 'silver'],
    dialog: '⛏🔜🥇🥈 Recovered <b>medals</b>!.',
  },

  {
    patient: 'boulder',
    left: 'empty',
    right: 'empty',
    verb: 'pick',
    items: ['pick'],
    dialog: '⛏ You find a pick under this boulder.',
  },

  // Involved in the quest for the trident and clued by herman.
  {
    patient: 'clover',
    left: 'empty',
    right: 'any',
    verb: 'pick',
    items: ['clover'],
    dialog: '☘️ One leaf shy of lucky.',
  },

  {
    patient: 'northPole',
    left: 'wetOpenUmbrella',
    right: 'any',
    verb: 'exchange',
    items: ['openUmbrella'],
    dialog:
      '🎅🤶 Worthy apprentice, travel now to the <b>Center of 🎲 Daia</b>! ',
    jump: 'location',
    morph: 'openNorthPole',
  },
  {
    patient: 'openNorthPole',
    verb: 'touch',
    items: [],
    dialog: '🎅🤶 Welcome back!',
    jump: 'location',
  },
  {
    patient: 'southPole',
    verb: 'touch',
    items: [],
    dialog: '🧙‍♂️ Up you go! 🧙‍♀️ ☔️',
    jump: 'location',
  },
  {
    patient: 'northLadder',
    verb: 'touch',
    items: [],
    dialog: '🎅Welcome back!🤶',
    jump: 'location',
  },
  {
    patient: 'southSlide',
    verb: 'touch',
    items: [],
    dialog: '🐧 Wheeeee! 🐧',
    jump: 'location',
  },

  // Clued at trollHut:
  {
    patient: 'cow',
    left: 'scissors',
    right: 'empty',
    items: ['labCoat'],
    verb: 'cut',
    morph: 'bull',
    dialog: '✂️ You take the cow’s <b>🥼 white coat</b>.',
  },

  // This is not clued and is redundant with knitting for the production of the
  // coat, but is essential to explaining that the coat stands for the leather
  // raw ingredient and will need a clue when these become essential.
  {
    patient: 'bull',
    left: 'scissors',
    right: 'empty',
    items: ['coat'],
    verb: 'cut',
    morph: 'cow',
    dialog: '✂️ You take the cow’s <b>🐂 leather jacket</b>.',
  },

  // Clued by brown bear:
  // On the minor quest line to restore the polar bear, then panda bear.
  // Not a mojical quest but hints at the progression.
  {
    patient: 'brownBear',
    left: 'labCoat',
    right: 'any',
    verb: 'give',
    items: [],
    morph: 'polarBear',
    dialog:
      '🐻‍❄️ Thank you for restoring my <b>🥼 cloak</b> <b>of invisibility</b>!',
  },

  // Clued: The gardener implies the existence of nightshades and the polar
  // bear suggests they want them.
  {
    patient: 'polarBear',
    left: 'nightShades',
    right: 'any',
    verb: 'exchange',
    items: ['soda'],
    morph: 'panda',
    dialog: '🐼 Thank you! The <b>❄️ snow</b> is so bright!',
  },

  // Clued by sheFairy, tanabata:
  ...['knife', 'axe', 'scissors', 'dagger'].map(left => ({
    patient: 'tanabata',
    left,
    right: 'empty',
    verb: 'cut',
    items: ['cane'],
    dialog: '🦯 You cut some cane.',
  })),

  // Clued by tractor:
  {
    patient: 'skeleton',
    left: 'empty',
    right: 'spoon',
    verb: 'pick',
    items: ['bone'],
  },

  // Clued by fishingBoat:
  {
    patient: 'blowFish',
    left: 'fishingRod',
    right: 'empty',
    verb: 'reap',
    items: ['blowFish'],
  },

  // Clued by herman:
  {
    patient: 'herman',
    left: 'trident',
    right: 'any',
    verb: 'give',
    morph: 'merman',
    dialog: '🧜‍♂️ Thank you!',
  },

  // Hydration
  {
    patient: 'merman',
    left: 'openUmbrella',
    right: 'any',
    verb: 'exchange',
    items: ['wetOpenUmbrella'],
    dialog:
      '🧜‍♂️ I have recharged your <b>☔️ wand</b> of <b>💨 wind</b> and <b>💦 water</b>! The <b>🤶 magi 🎅</b> will surely help you now!',
  },

  // Night shades
  {
    patient: 'potatoPlant',
    left: 'bone',
    right: 'spoon',
    verb: 'grow',
    items: ['potato'],
    dialog:
      'You grow a <b>🥔 potato</b>, the <i>🥇 Most Boring Nightshade</i>.',
  },
  ...['scissors', 'knife'].flatMap(tool => [
    {
      patient: 'tomatoPlant',
      left: 'bone',
      right: tool,
      verb: 'grow',
      items: ['tomato'],
      dialog:
        'You grow a <b>🍅 tomato</b>, almost the <i>🥈 Most Boring Nightshade</i>.',
    },
    {
      patient: 'auberginePlant',
      left: 'bone',
      right: tool,
      verb: 'grow',
      items: ['aubergine'],
      dialog:
        'You grow an <b>🍆 aubergine</b>, the <i>🏅 Lewdest Nightshade</i>.',
    },
    {
      patient: 'bellPepperPlant',
      left: 'bone',
      right: tool,
      verb: 'grow',
      items: ['bellPepper'],
      dialog:
        'You grow a <b>🫑 bell pepper</b>, the third <i>🥉 Most Boring Nightshade</i>.',
    },
    {
      patient: 'chiliPepperPlant',
      left: 'bone',
      right: tool,
      verb: 'grow',
      items: ['chiliPepper'],
      dialog:
        'You grow a <b>🌶 chili pepper</b>, the second <i>🎖 Most Aggressive Nightshade</i>.',
    },
  ]),

  {
    patient: 'yamPlant',
    left: 'bone',
    right: 'spoon',
    verb: 'grow',
    items: ['yam'],
    dialog: 'You grow a <b>🍠 yam</b>, which isn’t even a nightshade.',
  },
  {
    patient: 'carrotPlant',
    left: 'bone',
    right: 'spoon',
    verb: 'grow',
    items: ['carrot'],
    dialog:
      'You grow a <b>🥕 carrot</b>. What’s it for? Nobody <b>🤥 nose</b>.',
  },

  // Spelling advice with Dumbledore
  {
    patient: 'bee',
    left: 'trident',
    right: 'any',
    items: [],
    verb: 'touch',
    dialog:
      '🐝 The <b>🔱 wand</b> <b>of water’s</b> provenance lies in <b>👉 Occia</b>. Its 𝓫𝓵𝓮𝓼𝓼𝓲𝓷𝓰 is <b>💦 water</b>.',
  },
  {
    patient: 'bee',
    left: 'cane',
    right: 'any',
    items: [],
    verb: 'touch',
    dialog: '🐝 Is that a <b>🦯 cane</b> or a <b>🐡 puffer skewer</b>?',
  },
  {
    patient: 'bee',
    left: 'umbrella',
    right: 'any',
    items: ['openUmbrella'],
    verb: 'exchange',
    dialog:
      '🐝 Dumbledore opens your umbrella revealing the <b>☂️ wand</b> <b>of the</b> <b>💨 wind</b>! Go now to <b>👉 Occia</b> for the <b>💦 water blessing</b>…',
  },
  {
    patient: 'bee',
    left: 'openUmbrella',
    right: 'any',
    items: [],
    verb: 'touch',
    dialog:
      '🐝 The <b>🧜‍♂️ merman</b> will recall the <b>☔️ wand of</b> <b>💨 wind</b> <b>and</b> <b>💦 water</b>.',
  },
  {
    patient: 'bee',
    left: 'wetOpenUmbrella',
    right: 'any',
    items: [],
    verb: 'touch',
    dialog:
      '🐝 Take the <b>☔️ wand of</b> <b>💨 wind</b> <b>and</b> <b>💦 water</b> <b>☝️ north</b> to the <b>💈 tower</b> <b>of the Moji</b>.',
  },
  {
    patient: 'dumbBell',
    left: 'hammer',
    right: 'empty',
    verb: 'cut',
    items: ['tea'],
    dialog: '☕️ One lump or two?',
  },

  // Not clued:
  {
    patient: 'recyclingPlant',
    left: 'bone',
    right: 'any',
    verb: 'exchange',
    items: ['mushroom'],
    dialog: '🍄 Whoa.',
  },
];
