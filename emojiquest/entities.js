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
  {
    name: 'mountain',
    dialog: [
      '⛰ I contain <b>🥉 precious medals</b>…',
      '⛰ You cannot have them…',
      '⛰ Because they’re <i>mine</i>…',
      '⛰ (Unless you’re holding a <b>⛏ pick</b>.)🔚',
    ],
  },
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
      // '⚙️  / 🔗 🔜 🪝 ', // Skeleton clues this
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
      '👸 The <b>🦄 unicorn</b> has not been seen since <i>The Fall</i>…',
      '👸 The <b>🐉 dragon</b> is but a myth.',
      '👸 Will you be the one to restore the mojick of yore?🔚',
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
      '💂‍♂️ Over the water, <b>👉 east</b> from here…',
      '💂‍♂️ There is a <b>🐝 spelling bee</b>,',
      '💂‍♂️ A practitioner of mojick from before <i>The Fall</i>…',
      '💂‍♂️ Perhaps they yet possess some lore of <b>🪄 wands</b>.🔚',
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
      '🦉  I hear there’s a <b>snak</b>.🔚',
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
      '🎅	They must recreate the <b>☔️ wand of</b> <b>💨 wind</b> <i>and</i> <b>💦 water</b>…',
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
      '🐝 I now review <b>🪄 wands</b>.',
      '🐝 Those who seek to restore mojick…',
      '🐝 Would search <b>👉 east</b> for <b>🏊‍♂️ Herman</b>…',
      '🐝 On the central <b>🏝 Isle</b> <b>of Occia</b>…',
      '🐝 Then <b>👆 north</b> to the <b>🧝 elfs</b>…',
      '🐝 And the <b>🎅 elflord</b> at the <b>💈 Pole</b> <b>of Borea</b>.🔚',
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
    dialog: ['🌴 Wanna date?'],
  },
  {
    name: 'palmIsland',
    dialog: ['🏝 Wanna date?'],
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
      '🦈 Seas the day! 🔚',
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
    name: 'skeleton',
    dialog: [
      '🏴‍☠️ For ye a pirate to be…',
      '🏴‍☠️ A patch for an eye,',
      '🏴‍☠️ A peg for a leg,',
      '🏴‍☠️ And a handy <b>🪝 hook</b> you’ll need…',
      '🏴‍☠️ So craft a <b>🔗 link</b>…',
      '🏴‍☠️ O’er a <b>🥇 treasure</b> worked at a <b>🏭 forge</b>…',
      '🏴‍☠️ And high seas shall be y’r pleasure.🔚',
    ],
  },
  {
    name: 'blowFish',
    dialog: [
      '🐡 Puff puff puff puff…',
      '🐡 If my size does not dissuade you…',
      '🐡 And my spikes do fail to argue…',
      '🐡 Still, beware the juice inside…',
      '🐡 ’Tis more powerful than cyanide.🔚',
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
    dialog: ['🐼 I’m the <i>coolest</i> bear evar.🔚'],
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
  {
    name: 'tomatoPlant',
    tile: 'plant',
    dialog: [
      '🌱 I am a <b>🍅 tomato</b> plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And something <b>🔪 sharp ✂️</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'potatoPlant',
    tile: 'plant',
    dialog: [
      '🌱 I am a <b>🥔 potato</b> plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And a <b>🥄 shovel</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'auberginePlant',
    tile: 'plant',
    dialog: [
      '🌱 I am an <b>🍆 aubergine</b> plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And something <b>🔪 sharp ✂️</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'bellPepperPlant',
    tile: 'plant',
    dialog: [
      '🌱 I am an <b>🫑 bell pepper</b> plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And something <b>🔪 sharp ✂️</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'chiliPepperPlant',
    tile: 'plant',
    dialog: [
      '🌱 I am an <b>🌶 chili pepper</b> plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And something <b>🔪 sharp ✂️</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'yamPlant',
    tile: 'plant',
    dialog: [
      '🌱 I <b>🍠 yam</b> a plant.🔚',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And a <b>🥄 shovel</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'carrotPlant',
    tile: 'plant',
    dialog: [
      '🌱 I am a <b>🥕 carrot</b> a plant…',
      '🌱 Grow me with <b>🦴 fertilizer</b> in one <b>🫲 hand</b>…',
      '🌱 And a <b>🥄 shovel</b> in the <b>🫱 other</b>.🔚',
    ],
  },
  {
    name: 'gene',
    dialog: [
      '🧑‍🌾 Hello, I’m <b>Gene</b>…',
      '🧑‍🌾 <b>Gene <i>the Gnome</i></b>, at your service…',
      '🧑‍🌾 We mostly grow <b>🕶 nightshades</b>…',
      '🧑‍🌾 Plants need <b>🦴 bone</b> fertilizer to grow…',
      '🧑‍🌾 Use a <b>🥄 shovel</b> for roots…',
      '🧑‍🌾 Use something <b>🔪 sharp ✂️ </b> for fruit.🔚',
    ],
  },
  {
    name: 'openNorthPole',
    tile: 'northPole',
    dialog: ['🎅🤶	Welcome back!'],
  },
  {
    name: 'construction',
    tile: 'warning',
    dialog: [
      '🚧 Under Construction…',
      '🚧 New attractions…',
      '🚧 Coming Soon.🔚',
    ],
  },
  {
    name: 'sal',
    tile: 'lizard',
    dialog: [
      '🦎 Greetings, character…',
      '🦎 I am <b>Sal Mander</b>…',
      '🦎 The <i>Toadally Newtral</i>…',
      '🦎 I was once a <b>🐉 Dragon</b>…',
      '🦎 But that is not important right now!…',
      '🦎 Allow me to introduce our <b>🧙‍♂️ Developer</b>,',
      '🧙‍♂️ Hello, you have reached the end…',
      '🧙‍♂️ Of this preview…',
      '🧙‍♂️ Thank you for playing…',
      '🧙‍♂️ And please,',
      '🧙‍♂️ <b>🚮 leave feedback</b>!🔚',
    ],
  },
  {
    name: 'elfis',
    tile: 'theyElf',
    dialog: [
      '🧝 Well met, Stranger!…',
      '🧝 I travel on an errand of the <b>🎅 elflord</b> and <b>🤶 elflady</b>…',
      '🧝 I am to seek and guide promising mojicians to the <b>👆 north</b> <b>💈 pole</b>…',
      '🧝 Yet my boat…melted, so I seem fatèd to remain here forever.🔚',
    ],
  },
  {
    name: 'heFairy',
    dialog: [
      '🧚‍♂️ Of the five <i>⚄ Isles of Occia</i>…',
      '🧚‍♂️ A <b>🐡 puffer</b> can best be found…',
      '🧚‍♂️ In the <b>👆 north</b> by <b>👈 west</b>.🔚',
    ],
  },
  {
    name: 'sheFairy',
    dialog: [
      '🧚‍♀️ All about <i>Occia</i>, you will find…',
      '🧚‍♀️ <b>🎋 cane</b> grows along the shores…',
      '🧚‍♀️ For the most helpful <i>staff</i>…',
      '🧚‍♀️ <i>Reed</i> my lips:',
      '🧚‍♀️ Sugar cane is especially <i>“sticky”</i>.🔚',
    ],
  },
  {
    name: 'tractor',
    dialog: [
      '🧑‍🌾 There is no such thing as a shovel…',
      '🧑‍🌾 But if you need to dig up some <b>🦴 bones</b>…',
      '🧑‍🌾 A <b>🥄 spoon</b> will do in a pinch.',
      '🧑‍🌾 To make your own…',
      '🧑‍🌾 Weld a <b>🔩 bolt</b> over a <b>⚙️ gear</b>.🔚',
    ],
  },
  {
    name: 'trollHut',
    tile: 'hut',
    dialog: [
      '🧌 Surely you must admire…',
      '🧌 The <b>🐄 cow’s</b> white coat…',
      '🧌 I must wonder…',
      '🧌 Can they be shorn like <b>🐑 sheep</b>?🔚',
    ],
  },
  {
    name: 'schoolOfMerging',
    tile: 'school',
    dialog: [
      '🧑‍🏫 Some items can be merged with your bare hands…',
      '🧑‍🏫 Try making a <i>“pair”</i> of <b>🍎 apples</b>…',
      '🧑‍🏫 Hold an <b>🍎 apple</b> in your <b>🫲 left</b> hand…',
      '🧑‍🏫 Hold an <b>🍎 apple</b> in your <b>right 🫱</b> hand…',
      '🧑‍🏫 Then, to <b>🙌 combine</b> them……',
      '🧑‍🏫 Select one <b>🍎 apple</b> and then the <b>🍎 other</b>!',
    ],
  },
  {
    name: 'jim',
    tile: 'heWeightLifter',
    dialog: [
      '🏋️‍♂️ Hi, I’m <b>Jim</b>…',
      '🏋️‍♂️ This is the <b>Weighting Room</b>!',
      '🏋️‍♂️ For the finest <i>service</b>…',
      '🏋️‍♂️ <b>ring 🔨</b> the <b>🛎 dumb bell</b>.🔚',
    ],
  },
  {
    name: 'dumbBell',
    tile: 'bellhopBell',
    dialog: ['🛎 May I help you?', '🛎 Some <b>☕️ tea</b> perhaps?🔚'],
  },
  {
    name: 'mojickJohannson',
    tile: 'heBasketBallPlayer',
    dialog: [
      '⛹️‍♂️ Hi, I’m <i>Mojick Johannson</i>…',
      '⛹️‍♂️ I made my own <b>🏀 basketball</b>…',
      '⛹️‍♂️ The trick is to <i>weave</i> a good <b>🧺 basket</b>…',
      '⛹️‍♂️ The best <b>🦯 rushes</b> comes from the <b>🎋 tanabata</b> emojis…',
      '⛹️‍♂️ A <b>2️⃣  pair</b> of reeds are enough to weave a whole basket…',
      '⛹️‍♂️ Then <b>🙌 combine</b> the <b>🧺 basket</b> and a <b>🧶 ball</b>.🔚',
    ],
  },
  {
    name: 'disco',
    tile: 'discoBall',
    dialog: [
      '💃 Hi, I’m <b>Disco Sue</b>…',
      '🕺 And I’m <b>Disco Drew</b>…',
      '💃 Can’t have a disco without a <b>🥏 disc</b> and a <b>🧶 ball</b>!',
      '🕺 And a <b>🥏 discus</b> is itself just a <b>🔨 flat</b> <b>🏀 plastic</b> <b>ball</b>.🔚',
    ],
  },
  {
    name: 'galadyelf',
    tile: 'sheElf',
    dialog: [
      '🧝‍♀️ Well met. I am <b>Galadyelf</b>…',
      '🧝‍♀️ There cannot be much more to <b>☂️ wand</b> of the <b>💨 wind</b>…',
      '🧝‍♀️ Than a <i>blessing</i> on a mere <b>🌂 umbrella</b>…',
      '🧝‍♀️ And is that not merely a <b>🗡 sword</b> in a <b>🥏 disc?',
      '🧝‍♀️ I know of no more, but seek out <b>🏋️‍♀️ Jim</b> to the <b>👉 east</b> and <b>👇 south</b>.🔚',
    ],
  },
  {
    name: 'inigo',
    tile: 'fencer',
    dialog: [
      '🤺 Call me <b>Inigo</b>…',
      '🤺 Though one may favor a <b>✒️ pen</b>…',
      '🤺 They ought bring a <b>🗡 sword</b> to a duel anyway…',
      '🤺 It is after all not so much trouble…',
      '🤺 To add a length of <b>🔩 bolt</b> to a <b>🔪 knife</b>.🔚',
    ],
  },
  {
    name: 'occiaGuide',
    tile: 'theyFairy',
    dialog: [
      '🧚 These shores mark the end of <b>👈 Euia</b>…',
      '🧚 Bordering the fairy <b>🏝 isles</b> of <b>Occia 👉</b>…',
      '🧚 Most belovèd of all, the central atoll of <b>Oc</b>…',
      '🧚 The <b>🧊 ice waste</b> of <b>👆 Borea</b> is north…',
      '🧚 Bring a <b>🧥 jacket</b>!🔚',
    ],
  },
];
