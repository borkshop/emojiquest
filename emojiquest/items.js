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
  { name: 'potato', tip: 'Potato, the <i>🥇 Most Boring Nightshade</i>' },
  {
    name: 'tomato',
    tip: 'Tomato, almost the <i>🥈 Most Boring Nightshade</i>',
    comestible: true,
    health: 1,
  },
  { name: 'aubergine', tip: 'Aubergine, the <i>🏅 Lewdest Nightshade</i>' },
  {
    name: 'bellPepper',
    tip: 'Bell pepper, the third <i>🥉 Most Boring Nightshade</i>',
    comestible: true,
    health: 1,
  },
  {
    name: 'chiliPepper',
    tip: 'Chili pepper, the second <i>🎖 Most Aggressive Nightshade</i>',
    comestible: true,
    health: 2,
    stamina: -1,
  },
  { name: 'yam', tip: 'Yam, <b>😞 not a nightshade</b>' },
  { name: 'carrot', tip: '🥕 Is it a carrot? No one <b>nose</b>.' },
];
