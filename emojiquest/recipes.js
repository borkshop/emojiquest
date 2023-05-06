/** @param {import('../mechanics.js').RecipeDescription} recipe */
const ambi = ({ agent, reagent, ...rest }) => [
  { agent, reagent, ...rest },
  { agent: reagent, reagent: agent, ...rest },
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
  ...ambi({
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
