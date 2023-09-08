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
  { name: 'plant', text: '🌱 ' },
  { name: 'potato', text: '🥔 ' },
  { name: 'tomato', text: '🍅 ' },
  { name: 'aubergine', text: '🍆 ' },
  { name: 'bellPepper', text: '🫑 ' },
  { name: 'chiliPepper', text: '🌶 ' },
  { name: 'yam', text: '🍠' },
  { name: 'carrot', text: '🥕' },
  { name: 'gene', text: '🧑‍🌾' },
  { name: 'lizard', text: '🦎 ' },
  { name: 'skeleton', text: '☠️ ' },
  { name: 'theyElf', text: '🧝' },
  { name: 'heFairy', text: '🧚‍♂️' },
  { name: 'sheFairy', text: '🧚‍♀️' },
  { name: 'tractor', text: '🚜' },
  { name: 'hut', text: '🛖' },
  { name: 'school', text: '🏫' },
  { name: 'basket', text: '🧺' },
  { name: 'basketBall', text: '🏀' },
  { name: 'discoBall', text: '🪩' },
  { name: 'discus', text: '🥏' },
  { name: 'heWeightLifter', text: '🏋️‍♂️' },
  { name: 'heBasketBallPlayer', text: '⛹️‍♂️' },
  { name: 'bellhopBell', text: '🛎' },
  { name: 'hotBeverage', text: '☕️' },
  { name: 'sheElf', text: '🧝‍♀️' },
  { name: 'fencer', text: '🤺' },
  { name: 'theyFairy', text: '🧚' },
];
