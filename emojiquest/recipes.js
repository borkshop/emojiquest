/** @param {import('../mechanics.js').RecipeDescription} recipe */
const ambi = ({ agent, reagent, ...rest }) => [
  { agent, reagent, ...rest },
  { agent: reagent, reagent: agent, ...rest },
];

const nightShades = [
  'tomato',
  'potato',
  'aubergine',
  'bellPepper',
  'chiliPepper',
];

const balls = ['yarn', 'basketBall'];

function* nightShadeRecipes() {
  for (const agent of nightShades) {
    for (const reagent of nightShades) {
      if (agent !== reagent) {
        yield {
          agent,
          reagent,
          product: 'nightShades',
          dialog: 'You combine a pair of <b>🕶  night shades</b>.',
        };
      }
    }
  }
}

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
  { agent: 'bolt', reagent: 'gear', product: 'spoon', price: 5 }, // Clue: cow, tractor
  { agent: 'bolt', reagent: 'link', product: 'wrench', price: 3 },
  { agent: 'gear', reagent: 'bolt', product: 'pick', price: 5 },
  { agent: 'gear', reagent: 'gear', product: 'bicycle', price: 6 },
  { agent: 'gear', reagent: 'link', product: 'shield', price: 4 },
  { agent: 'link', reagent: 'gear', product: 'hook', price: 4 },
  { agent: 'link', reagent: 'bolt', product: 'hammer', price: 3 },
  { agent: 'link', reagent: 'link', product: 'chain', price: 2 },

  // metallurgy 2
  { agent: 'knife', reagent: 'knife', product: 'scissors', price: 8 },
  // Clued by Galadyelf.
  { agent: 'bolt', reagent: 'knife', product: 'dagger', price: 6 },
  { agent: 'hammer', reagent: 'knife', product: 'axe', price: 7 },
  { agent: 'hammer', reagent: 'pick', product: 'hammerAndPick', price: 8 },
  { agent: 'hammer', reagent: 'wrench', product: 'hammerAndWrench', price: 6 },
  { agent: 'gear', reagent: 'chain', product: 'bin', price: 5 },

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
  ...ambi({
    agent: 'cane',
    reagent: 'hook',
    product: 'fishingRod',
    dialog: '🎣 Gon’ fishin’.',
  }),

  // Metallurgy 3
  { agent: 'bicycle', reagent: 'bin', product: 'cart' },
  { agent: 'dagger', reagent: 'dagger', product: 'doubleDagger' },

  // Composite 3
  {
    agent: 'knittingNeedles',
    reagent: 'yarn',
    product: 'coat',
    byproduct: 'knittingNeedles',
  },

  // Clued by Mojick John.
  { agent: 'basket', reagent: 'yarn', product: 'basketBall' },

  // Composite 4
  // Clued by Disco.
  {
    agent: 'basketBall',
    reagent: 'hammer',
    product: 'discus',
    byproduct: 'hammer',
    dialog: '🔨 Hammer…smash! 🥏',
  },

  // Composite 5
  // Not on any quest line, but Disco provides clue for Discus.
  ...balls.map(ball => ({
    agent: 'discus',
    reagent: ball,
    product: 'discoBall',
    dialog: '🪩 Go! Go! Disco!',
  })),

  // Clued by Galadyelf
  { agent: 'discus', reagent: 'dagger', product: 'umbrella' },

  // A joke that clarifies the game a little.
  {
    agent: 'apple',
    reagent: 'apple',
    product: 'pear',
    dialog: 'Now you have a <b>🍐 pear</b> of <b>🍎 apples</b>!',
  },

  // Not clued and redundant with Galadyelf's recipe.
  {
    agent: 'cane',
    reagent: 'blowFish',
    product: 'umbrella',
    dialog:
      'You skewer the blowfish, making an <b>🌂 umbrella</b>. It feels like it might be a <b>🪄 wand</b>.',
  },

  // Clued by Mojick Johannson
  {
    agent: 'cane',
    reagent: 'cane',
    product: 'basket',
    dialog: 'You weave a <b>🧺 basket</b>.',
  },

  // Hinted very indirectly by Gene the Gnome
  ...nightShadeRecipes(),
];
