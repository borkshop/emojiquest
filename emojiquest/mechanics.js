/**
 * The data module provides the pure-data facet of the mechanics of Emoji Quest
 * including descriptions of all the entity types in the game including
 * tiles, items, effects and agents.
 *
 * The mechanics module creates indices of these data types.
 */

// @ts-check

/** @param {import('../mechanics.js').RecipeDescription} recipe */
const ambiRecipe = ({ agent, reagent, ...rest }) => [
  { agent, reagent, ...rest },
  { agent: reagent, reagent: agent, ...rest },
];

/** @param {import('../mechanics.js').ActionDescription} action */
const ambiAction = ({ left, right, ...rest }) => [
  { left, right, ...rest },
  { left: right, right: left, ...rest },
];

/**
 * Agent types are captured by index in game state and are not safe to reorder
 * or delete.
 *
 * @type {Array<import('../mechanics.js').AgentDescription>}
 */
export const agentTypes = [
  {
    name: 'player',
    tile: 'happy',
    health: 5,
    stamina: 0,
    modes: [
      { tile: 'ecstatic', health: 5, stamina: 5 },
      { tile: 'swimming', immersed: true },
      { tile: 'boating', immersed: true, holds: 'canoe' },
      { tile: 'cold', cold: true },
      { tile: 'hot', hot: true },
      { tile: 'sad', health: 3 },
      { tile: 'bad', health: 2 },
      { tile: 'grimmace', health: 1 },
      { tile: 'death', health: 0 },
    ],
    slots: [
      { tile: 'left', held: true },
      { tile: 'right', held: true },
      { tile: 'one', pack: true },
      { tile: 'two', pack: true },
      { tile: 'three', pack: true },
      { tile: 'four', pack: true },
      { tile: 'six', pack: true },
      { tile: 'seven', pack: true },
      { tile: 'eight', pack: true },
      { tile: 'nine', pack: true },
    ],
  },
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
      '🥉🥉🔜🥈 Trade small for large…',
      '🥈🥉🔜🥇 Or, large for larger…',
      '🥇🔜🥈🥉 Even break your change…',
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
      '🥉 🔜  🔗  We make links from copper…',
      '🥈 🔜  🔩  Bolts from silver…',
      '🥇 🔜  ⚙️   And gears from gold…',
      '👨‍🏭	Components can be combined to make other components…',
      '🔩 / 🔩 🔜 🔪 You can forge knives from bolts… ',
      '🔗 / 🔩 🔜 🔨 A link over a bolt makes a hammer…',
      '👩‍🏭	The combinations are quite exhaustive! 🔚',
      // '🔩 / ⚙️  🔜 🥄 ', // Cow clues this
      // '🔨 / 🔪 🔜 🪓 ', // Jack and Hariet clue this
      // '🔪 / 🔪 🔜 ✂️  ', // Harriet clues this
      // '🔗 / 🔗 🔜 ⛓ ',
      // '🔩 / 🔗 🔜 🔧 ',
      // '⚙️ /  🔗 🔜 🛡 ',
      // '⚙️  / 🔗 🔜 🪝 ', // Pirate clues this
      // '⚙️  / 🔩 🔜 ⛏ ',
      // '⚙️  / ⚙️  🔜 🚲 ',
      // '🔩 / 🔪 🔜 🗡 ',
      // '🔨 / 🔧 🔜 🛠 ',
      // '⚙️  / ⛓ 🔜 🗑 ',
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
      '💇‍♀️ That’s why scissors are an improvement over just <b>🔪 two knives</b>…',
      '💇‍♀️ I knit with <b>🧶 yarn</b> and <b>🥢 needles</b>…',
      '💇‍♀️ My friend, <b>🧓 Jack</b> <b>🔪 whittled</b> my needles from <b>🪵 wood</b>. 🔚',
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
      '🧓    A <b>🪵 Lumber Jack</b> needs an <b>🪓 axe</b>…',
      '🧓    For an <b>🪓 axe</b>, <b>🏭 forge</b> a <b>🔪 knife</b> on a <b>🔨 hammer</b>. 🔚',
    ],
  },
  {
    name: 'glub',
    tile: 'fish',
    dialog: [
      '🐟    You are not a fish…',
      '🐟    Fish do not need <b>🛶 canoes</b>…',
      '🐟    Fish can swim over the <b>edge of the world</b>…',
      '🐟    Canoes are made from <b>🪵 wood</b>…',
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
      '🎅	They must recreate the <b>☔️ wand of</b> <b>wind and water</b>…',
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
  { name: 'swimBriefs' }, // temporary
  {
    name: 'cow',
    dialog: [
      '🐄 Moo, Low, Clue…',
      '🐄 Weld <b>🔩 bolt</b> over a <b>⚙️  gear</b>…',
      '🐄 Then, like a <b>🍽 dish</b>, you can run away with a <b>🥄 spoon</b>…',
      '🐄 Or hollow out a <b>🪵 log</b> to make a <b>🛶 canoe…',
      '🐄 Whatever works for you! 🔚',
    ],
  },
  {
    name: 'palmTree',
    dialog: ['🌴 This is bananas.', '🌴 Wanna date?'],
  },
  {
    name: 'palmIsland',
    dialog: ['🏝 This is bananas.', '🏝 Wanna date?'],
  },
  {
    name: 'sponge',
    dialog: [
      '🧽  I’m planted, but not a plant…',
      '🧽  I’m inanimate, yet am an animal…',
      '🧽  I’m a *sponge*. 🔚',
    ],
  },
  {
    name: 'shark',
    dialog: [
      '🦈 I am a <b>loan shark</b>…',
      '🦈 I won’t bite…',
      '🦈 But, I will exchange <b>🥉🥈🥇 precious</b> <b>medals</b>…',
      '🦈 MARIA DIEI:<br> Seas the day! 🔚',
    ],
  },
  {
    name: 'southPole',
    dialog: [
      '🧙‍♀️ I am the <b>Sand Witch</b>…',
      '🧙‍♂️ And I am the <b>Cheese Wizard</b>…',
      '🧙‍♀️ We just live here, but don’t tell the <b>🐧 penguins</b>…',
      '🧙‍♂️ Definitely do not <i>approach</i> the <b>🐧 penguins</b>. 🔚',
    ],
  },
  {
    name: 'northLadder',
    tile: 'ladder',
  },
  {
    name: 'southSlide',
    tile: 'slide',
  },
  {
    name: 'recyclingPlant',
    tile: 'mushroom',
    dialog: [
      '🍄 We are the Champignons!…',
      '🍄 We live in the dark and eat <b>💩 waste</b>…',
      '🍄 So, it could be argued…',
      '🍄 …that we’re a <b>recycling plant</b>!…',
      '🍄 Come to us to recycle <b>🥉medals</b>! 🔚',
      '🧙‍♂️ (I regret nothing!)',
    ],
  },
  {
    name: 'jack2',
    dialog: [
      '🧓    It’s hard to stay warm in the <b>❄️  frigid north</b>…',
      '🧓    That’s why I knit myself a <b>🧥 Jacket</b>…',
      '🧓    To knit, you’ll need <b>🧶 yarn</b> and <b>🥢 needles</b>…',
      '🧓    I <b>🔪 whittled</b> my needles out of <b>🪵 wood</b>. 🔚',
    ],
  },
  {
    name: 'gift',
    dialog: ['🎁 Present and accounted for.🔚'],
  },
  {
    name: 'bull',
    dialog: [
      '🐂 Moo, Low, Clue…',
      '🐂 Weld <b>🔩 bolt</b> over a <b>⚙️  gear</b>…',
      '🐂 Then, like a <b>🍽 dish</b>, you can run away with a <b>🥄 spoon</b>…',
      '🐂 Or hollow out a <b>🪵 log</b> to make a <b>🛶 canoe…',
      '🐂 Whatever works for you! 🔚',
    ],
  },
  {
    name: 'brownBear',
    dialog: [
      '🐻 I am Arctus of Borea…',
      '🐻 I have fallen on hard times…',
      '🐻 …since I lost my <b>🥼 cloak</b> <b>of invisibility</b>. 🔚',
    ],
  },
  {
    name: 'polarBear',
    dialog: [
      '🐻‍❄️ I am so happy to be a polar bear again…',
      '🐻‍❄️ Only a pair of <b>🕶 night shades</b> would make me cooler…',
      '🐻‍❄️ Thank you again for restoring my 🥼 cloak.🔚',
    ],
  },
  {
    name: 'tanabata',
    dialog: [
      '🎋 I am Tanabata…',
      '🎋 I can grant a wish…',
      '🎋 As long as you wish…',
      '🎋 For a <b>🦯 long stick</b>…',
      '🎋 And only if you wish…',
      '🎋 With <b>🔪 something sharp</b>. 🔚',
    ],
  },
  {
    name: 'fishingBoat',
    dialog: [
      '🛥 You’ll need a <b>🎣 fishing rod</b>…',
      '🛥 To make one, attach a <b>🪝 hook</b>…',
      '🛥 To a <b>🦯 stick</b> of some kind.🔚',
    ],
  },
  {
    name: 'pirate',
    dialog: [
      '🏴‍☠️ For ye a pirate to be…',
      '🏴‍☠️ A patch for an eye,',
      '🏴‍☠️ A peg for a leg,',
      '🏴‍☠️ And a handy <b>🪝 hook</b> you’ll need…',
      '🏴‍☠️ So craft a <b>🔗 link</b>…',
      '🏴‍☠️ O’er the work of <b>🥇 treasure</b>…',
      '🏴‍☠️ And high seas shall be y’r pleasure.🔚',
    ],
  },
  {
    name: 'blowFish',
    dialog: [
      '🐡 Puff puff puff puff…',
      '🐡 If my size does not dissuade you…',
      '🐡 And my spikes do fail to argue…',
      '🐡 Still, beware the poison inside…',
      '🐡 It’s more toxic than cyanide.🔚',
    ],
  },
  {
    name: 'mountainCyclist',
    dialog: [
      '🚵 Bikes get stolen a lot…',
      '🚵 Perhaps this is because…',
      '🚵 With the right <b>⚙️ gear⚙️</b>…',
      '🚵 They are a great store for <b>🥇value🥇</b>.🔚',
    ],
  },
  {
    name: 'skull',
    tile: 'death',
    dialog: ['💀 I feel happy!🔚'],
  },
  {
    name: 'treasure',
    tile: 'gold',
    dialog: ['🏴‍☠️  marks the spot!'],
  },
  {
    name: 'panda',
    dialog: ['🐼 I’m the coolest bear evar.🔚'],
  },
  {
    name: 'gift2',
    tile: 'gift',
    dialog: ['🎁 Present and accounted for.🔚'],
  },
  {
    name: 'merman',
    dialog: [
      '🧜‍♂️ I am <b>Herman</b>…',
      '🧜‍♂️ <i>Wait for it…</i>',
      '🧜‍♂️ Herman the <b>Merman</b>!…',
      '🧜‍♂️ Thank you for restoring my <b>🔱 trident</b>…',
      '🧜‍♂️ I can <b>💦 hydrate</b> some things…',
      '🧜‍♂️ Imbuing them with the mojick of <b>💦 water</b>…',
      '🧜‍♂️ So you can come to me if you don’t have your own <b>🔱 trident</b>.🔚',
    ],
  },
  {
    name: 'herman',
    dialog: [
      '🏊‍♂️ I am <b>Herman</b>…',
      '🏊‍♂️ I once had a <b>🔱 trident</b>…',
      '🏊‍♂️ It is a wand of <b>💦 water</b> mojicks…',
      '🏊‍♂️ Legend is that you can <b>🥇 gild</b> a <b>🌼 lily</b>…',
      '🏊‍♂️ But that’s not important right now…',
      '🏊‍♂️ Maybe you can gild a three-lobed <b>☘️ clover</b>…',
      '🏊‍♂️ You would probably need a <b>🏭 forge</b>.🔚',
    ],
  },
];

/**
 * Item types are captured by index in game state and are not safe to reorder
 * or delete.
 *
 * @type {Array<import('../mechanics.js').ItemDescription>}
 */
export const itemTypes = [
  {
    name: 'axe',
    tip: '🪓 Did you know that <b>axe</b>, <b>acid</b>, and <b>oxygen</b> are all related words?',
  },
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
  { name: 'canoe', tip: '🛶 Row, row, row your boat.', boat: true },
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
    tip: '🧥 It’s a coat! It’s a jacket! No, it’s <b>super warm</b>!',
    heat: 1,
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
  {
    name: 'swimBriefs',
    tip: '🩲 Keep on swimming.',
    swimGear: true,
  },
  {
    name: 'banana',
    tip: '🍌 It’s peanut butter jelly time.',
    comestible: true,
    health: 1,
  },
  {
    name: 'date',
    tip: '📆 Try the figs too.',
    comestible: true,
    stamina: 1,
  },
  {
    name: 'umbrella', // deprecated until further notice
    tip: '🌂 Harness the <b>💨 mojick</b> <b>of wind!</b>',
  },
  { name: 'wood', tile: 'log', tip: '🪵 Wood be nice.' },
  { name: 'labCoat', tip: '🥼 For science or something.', heat: 1 },
  { name: 'cane', tip: '🦯 Some sort of walking stick.' },
  { name: 'skull', tile: 'death', tip: '💀 Alas, I knew him well.' },
  { name: 'bone', tip: '🦴 I have a bone to pick with you!' },
  { name: 'blowFish', tip: '🐡 Fully inflated.' },
  {
    name: 'openUmbrella',
    tip: '☂️  Harness the <b>💨 mojick</b> of <b>wind!</b>',
  },
  {
    name: 'wetOpenUmbrella',
    tip: '<b>☔️ Wand</b> of <b>💨 wind</b> <i>and</i> <b>💦 water</b>. The <b>🎅 magi 🤶</b> will surely help you now!',
  },
  { name: 'nightShades', tip: '<b>🕶 Shades</b> dark as night.' },
  { name: 'soda', tip: '<i>🥤 slurp</i>', comestible: true, health: 5 },
  { name: 'trident', tip: 'The <b>🔱 trident</b>: wand of <b>💦 water</b>' },
];

/**
 * Tile types are not captured numerically in game state so these are safe to
 * reorder.
 *
 * @type {Array<import('../mechanics.js').TileDescription>}
 */
export const tileTypes = [
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
  { name: 'jack2', text: '🧍‍♂️' },
  { name: 'fish', text: '🐟    ' },
  { name: 'owl', text: '🦉   ' },
  { name: 'log', text: '🪵 ' },
  { name: 'northPole', text: '💈    ' },
  { name: 'southPole', text: '🗼    ' },
  { name: 'clover', text: '☘️    ' },
  { name: 'fleurDeLis', text: '⚜️   ' },
  { name: 'trident', text: '🔱     ' },
  { name: 'warning', text: '🚧     ' },
  { name: 'bee', text: '🐝     ' },
  { name: 'cold', text: '🥶' },
  { name: 'hot', text: '🥵' },
  { name: 'swimming', text: '🏊' },
  { name: 'boating', text: '🚣' },
  { name: 'death', text: '💀  ' },
  { name: 'ecstatic', text: '😀       ' }, // 5
  { name: 'sad', text: '🙁  ' }, // 3
  { name: 'bad', text: '☹️         ' }, // 2
  { name: 'grimmace', text: '😬          ' }, // 1
  { name: 'swimBriefs', text: '🩲  ' },
  { name: 'cow', text: '🐄   ' },
  { name: 'palmTree', text: '🌴' },
  { name: 'palmIsland', text: '🏝' },
  { name: 'date', text: '📆   ' },
  { name: 'banana', text: '🍌' },
  { name: 'sponge', text: '🧽' },
  { name: 'shark', text: '🦈    ' },
  { name: 'ladder', text: '🪜    ' },
  { name: 'slide', text: '🛝      ' },
  { name: 'mushroom', text: '🍄  ' },
  { name: 'umbrella', text: '🌂  ' },
  { name: 'gift', text: '🎁' },
  { name: 'bull', text: '🐂' },
  { name: 'labCoat', text: '🥼 ' },
  { name: 'brownBear', text: '🐻 ' },
  { name: 'polarBear', text: '🐻‍❄️' },
  { name: 'tanabata', text: '🎋' },
  { name: 'cane', text: '🦯' },
  { name: 'blowFish', text: '🐡' },
  { name: 'openUmbrella', text: '☂️' },
  { name: 'wetOpenUmbrella', text: '☔️ ' },
  { name: 'fishingBoat', text: '🛥' },
  { name: 'pirate', text: '☠️' },
  { name: 'mountainCyclist', text: '🚵' },
  { name: 'bone', text: '🦴' },
  { name: 'nightShades', text: '🕶' },
  { name: 'soda', text: '🥤 ' },
  { name: 'panda', text: '🐼' },
  { name: 'merman', text: '🧜‍♂️' },
  { name: 'herman', text: '🏊‍♂️' },
];

/**
 * Recipes are not _yet_ captured by index in game state, but probably
 * will need to be for tracking achievements.
 *
 * The Mechanics type assigns bumpKeys to each recipe at runtime, but the bump
 * keys are also not guaranteed to be consistent between versions of the
 * mechanics as the game grows and will not be captured in game state.
 *
 * @type {Array<import('../mechanics.js').RecipeDescription>}
 */
export const recipes = [
  // metallurgy 1
  { agent: 'bolt', reagent: 'bolt', product: 'knife', price: 4 },
  { agent: 'bolt', reagent: 'gear', product: 'spoon', price: 5 },
  { agent: 'bolt', reagent: 'link', product: 'wrench', price: 3 },
  { agent: 'gear', reagent: 'bolt', product: 'pick', price: 5 },
  { agent: 'gear', reagent: 'gear', product: 'bicycle', price: 6 },
  { agent: 'gear', reagent: 'link', product: 'shield', price: 4 },
  { agent: 'link', reagent: 'gear', product: 'hook', price: 4 },
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
  { agent: 'spoon', reagent: 'wood', product: 'canoe', byproduct: 'spoon' },
  {
    agent: 'knife',
    reagent: 'wood',
    product: 'knittingNeedles',
    byproduct: 'knife',
  },
  {
    agent: 'axe',
    reagent: 'wood',
    product: 'knittingNeedles',
    byproduct: 'axe',
  },
  ...ambiRecipe({
    agent: 'cane',
    reagent: 'hook',
    product: 'fishingRod',
    dialog: '🎣 Gon’ fishin’.',
  }),

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

  {
    agent: 'cane',
    reagent: 'blowFish',
    product: 'openUmbrella',
    dialog: 'You skewer the blowfish making an <b>☂️ umbrella</b>',
  },

  {
    agent: 'openUmbrella',
    reagent: 'trident',
    product: 'wetOpenUmbrella',
    byproduct: 'trident',
    dialog:
      'You <i>charge</i> the <b>🌂wand</b> of <b>💨 wind</b> with <b>💦 water</b>! The <b>🎅 magi 🤶</b> will surely help you now!',
  },
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
  ...ambiAction({
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
  ...ambiAction({
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

// TODO 🪨rock, 📄paper, ✂️scissors, 🦎lizard, 🖖spock

/** @type {Array<import('../mechanics.js').EffectDescription>} */
export const effectTypes = [];
