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
    items: ['gold', 'canoe'],
    verb: 'cut',
    dialog: '🎁 It is dangerous to go alone. Take this!',
  },
  {
    patient: 'gift2',
    left: 'empty',
    right: 'any',
    items: ['clover'],
    verb: 'cut',
    dialog: '🎁 It is dangerous to go alone. Take this!',
  },

  // raw material
  {
    patient: 'axe',
    verb: 'take',
    items: ['axe'],
    dialog: '🪓 You get an axe.',
  },
  { patient: 'coat', verb: 'take', items: ['coat'] }, // temporary
  { patient: 'swimBriefs', verb: 'take', items: ['swimBriefs'] }, // temporary
  {
    patient: 'pineTree',
    left: 'axe',
    verb: 'reap',
    items: ['wood'],
    dialog: '🌲🪓🔜🪵 You chop down a pine tree.',
  },
  {
    patient: 'appleTree',
    left: 'axe',
    verb: 'reap',
    items: ['wood'],
    dialog: '🌳🪓🔜🪵 You chop down an apple tree.',
  },
  {
    patient: 'pick',
    right: 'any',
    verb: 'take',
    items: ['pick'],
    dialog: '⛏ Got pick?',
  },
  {
    patient: 'mountain',
    left: 'pick',
    verb: 'cut',
    items: ['copper'],
    dialog: '⛰⛏🔜🥉 You win copper!',
  },
  {
    patient: 'ewe',
    left: 'scissors',
    verb: 'cut',
    items: ['yarn'],
    dialog: '🐑✂️🔜🧶 Wool becomes ewe?',
  },
  {
    patient: 'ewe',
    left: 'knife',
    verb: 'reap',
    items: ['meat'],
    dialog: '🐑🔪🔜🥩 Was this a Miss Steak?',
  },
  {
    patient: 'ram',
    left: 'scissors',
    verb: 'cut',
    items: ['yarn'],
    dialog: '🐏✂️🔜🧶 Shear audacity!',
  },
  {
    patient: 'ram',
    left: 'knife',
    verb: 'reap',
    items: ['meat'],
    dialog: '🐏🐑🔪🔜🥩 Meat your maker!',
  },
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
  {
    patient: 'pineTree',
    right: 'any',
    verb: 'pick',
    items: ['pineApple'],
    dialog: '🍍 Got <i>pine</i> apple. ',
  },
  {
    patient: 'palmTree',
    right: 'any',
    verb: 'pick',
    items: ['banana'],
    dialog: '🍌 Got banana.',
  },
  {
    patient: 'palmIsland',
    right: 'any',
    verb: 'pick',
    items: ['banana'],
    dialog: '🍌 Got banana.',
  },

  // monetary exchange
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
    verb: 'split',
    items: ['copper', 'copper'],
    dialog: '🥈🔜🥉🥉 A bird in hand is worth two in the bush.',
  },
  {
    patient: 'bank',
    left: 'gold',
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
    verb: 'split',
    items: ['copper', 'copper'],
    dialog: '🥈🔜🥉🥉 A fish in jaws is worth two in the coral.',
  },
  {
    patient: 'shark',
    left: 'gold',
    verb: 'split',
    items: ['silver', 'copper'],
    dialog: '🥇🔜🥈🥉 Divide and conquer.',
  },

  // forgery
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

  // recycling
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
    left: 'basket',
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
    verb: 'pick',
    items: ['pick'],
    dialog: '⛏ You find a pick under this boulder.',
  },
  {
    patient: 'clover',
    right: 'any',
    verb: 'pick',
    items: ['clover'],
    dialog: '☘️ One leaf shy of lucky.',
  },

  {
    patient: 'northPole',
    left: 'wetOpenUmbrella',
    right: 'any',
    verb: 'touch',
    items: [],
    dialog: '🎅Down you go!🤶 ☔️',
    jump: 'entity',
  },
  {
    patient: 'southPole',
    left: 'wetOpenUmbrella',
    right: 'any',
    verb: 'touch',
    items: [],
    dialog: '🧙‍♂️ Up you go! 🧙‍♀️ ☔️',
    jump: 'entity',
  },
  {
    patient: 'northLadder',
    right: 'any',
    verb: 'touch',
    items: [],
    dialog: '🎅Welcome back!🤶',
    jump: 'entity',
  },
  {
    patient: 'southSlide',
    right: 'any',
    verb: 'touch',
    items: [],
    dialog: '🐧 Wheeeee! 🐧',
    jump: 'entity',
  },

  {
    patient: 'cow',
    left: 'scissors',
    right: 'empty',
    items: ['labCoat'],
    verb: 'cut',
    morph: 'bull',
    dialog: '✂️ You take the cow’s <b>🥼 white coat</b>.',
  },
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
  {
    patient: 'polarBear',
    left: 'nightShades',
    right: 'empty',
    verb: 'exchange',
    items: ['soda'],
    morph: 'panda',
    dialog: '🐼 Thank you! The <b>❄️ snow</b> is so bright!',
  },

  ...['knife', 'axe', 'scissors', 'dagger'].map(left => ({
    patient: 'tanabata',
    left,
    right: 'empty',
    verb: 'cut',
    items: ['cane'],
    dialog: '🦯 You cut some cane.',
  })),

  // treasure dig
  {
    patient: 'pirate',
    left: 'empty',
    right: 'empty',
    verb: 'pick',
    items: ['bone', 'bone'],
    morph: 'skull',
  },
  {
    patient: 'skull',
    left: 'spoon',
    right: 'empty',
    verb: 'cut',
    items: ['skull'],
    morph: 'treasure',
  },
  ...ambi({
    patient: 'treasure',
    left: 'empty',
    right: 'any',
    verb: 'take',
    items: ['gold'],
  }),

  {
    patient: 'blowFish',
    left: 'fishingRod',
    right: 'empty',
    verb: 'reap',
    items: ['blowFish'],
  },
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
];
