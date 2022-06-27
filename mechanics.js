/**
 * The mechanics module captures the mechanical elements of the Emoji Quest
 * game, providing indexes into the game's data tables for entity types and
 * formulae.
 */

// @ts-check

import { assertDefined, assumeDefined } from './assert.js';
import { halfOcturn, fullOcturn, quarturnToOcturn } from './geometry2d.js';

/**
 * @typedef {{
 *   name: string,
 *   tile?: string,
 *   wanders?: string,
 *   dialog?: Array<string>,
 *   health?: number,
 *   stamina?: number,
 *   modes?: Array<{
 *     tile: string,
 *     holds?: string,
 *     has?: string,
 *     hot?: true,
 *     cold?: true,
 *     sick?: true,
 *     dead?: true,
 *     immersed?: true,
 *   }>,
 * }} AgentType
 */

/** @typedef {{has: true, item: number} |
 *   {holds: true, item: number} |
 *   {hot: true} |
 *   {cold: true} |
 *   {sick: true} |
 *   {immersed: true} |
 *   {dead: true}
 * } Condition */

/**
 * @typedef {{
 *   name: string,
 *   tile?: string,
 *   comestible?: boolean,
 *   health?: number,
 *   stamina?: number,
 *   heat?: number,
 *   boat?: boolean,
 *   tip?: string,
 * }} ItemType
 */

/**
 * @typedef {{
 *   name: string,
 *   text: string,
 *   turn?: number,
 * }} TileType
 */

/**
 * @typedef {{
 *   agent: string,
 *   reagent: string,
 *   product: string,
 *   byproduct?: string,
 *   price?: number,
 *   dialog?: string,
 * }} Recipe
 */

/**
 * @typedef {{
 *   agent?: string,
 *   patient: string,
 *   left?: string,
 *   right?: string,
 *   effect?: string,
 *   verb: string,
 *   items: Array<string>,
 *   dialog?: string,
 * }} Action
 */

/**
 * @typedef {{
 *   name: string,
 *   tile?: string,
 * }} EffectType
 */

/**
 * @typedef {Object} Kit
 * @property {(entity: number) => number} entityType
 * @property {(entity: number) => number} entityEffect
 * @property {(entity: number, slot: number) => number} inventory
 * @property {(entity: number, slot: number, itemType: number) => void} put
 * @property {(entity: number, itemType: number) => boolean} has
 * @property {(entity: number, itemType: number) => boolean} holds
 * @property {(entity: number) => boolean} cold
 * @property {(entity: number) => boolean} hot
 * @property {(entity: number) => boolean} sick
 * @property {(entity: number) => boolean} immersed
 * @property {(entity: number) => boolean} dead
 * @property {import('./model.js').MacroViewModel} macroViewModel
 * @property {(entity: number, location: number) => void} destroyEntity
 */

const specialNames = ['invalid', 'empty', 'any'];
const specialDescriptions = specialNames.map(name => ({ name }));

/**
 * @typedef {ReturnType<makeMechanics>} Mechanics
 */
/**
 * @param {Object} args
 * @param {Array<Recipe>} [args.recipes]
 * @param {Array<Action>} [args.actions]
 * @param {Array<TileType>} [args.tileTypes]
 * @param {Array<AgentType>} [args.validAgentTypes]
 * @param {Array<ItemType>} [args.validItemTypes]
 * @param {Array<EffectType>} [args.validEffectTypes]
 */
export function makeMechanics({
  recipes = [],
  actions = [],
  tileTypes = [],
  validAgentTypes = [],
  validItemTypes = [],
  validEffectTypes = [],
} = {}) {
  /** @type {Array<AgentType>} */
  const agentTypes = [
    ...specialDescriptions,
    ...validAgentTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<ItemType>} */
  const itemTypes = [
    ...specialDescriptions,
    ...validItemTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<EffectType>} */
  const effectTypes = [
    ...specialDescriptions,
    ...validEffectTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /**
   * @param {string} agent
   * @param {string} reagent
   * @param {string} product
   * @param {string} [byproduct]
   * @param {string} [dialog]
   */
  function registerRecipe(
    agent,
    reagent,
    product,
    byproduct = 'empty',
    dialog,
  ) {
    const agentType = itemTypesByName[agent];
    const reagentType = itemTypesByName[reagent];
    const productType = itemTypesByName[product];
    const byproductType = itemTypesByName[byproduct];
    assertDefined(agentType, `agent item type not defined ${agent}`);
    assertDefined(reagentType, `reeagent item type not defined ${reagent}`);
    assertDefined(productType, `product item type not defined ${product}`);
    assertDefined(
      byproductType,
      `byproduct item type not defined ${byproduct}`,
    );
    // Ideally, every bump has a dialog, but if it doesn't, lets display the
    // tip for the product.
    const productDescription = assumeDefined(itemTypes[productType]);
    craftingFormulae.set(agentType * itemTypes.length + reagentType, [
      productType,
      byproductType,
      dialog || productDescription.tip,
    ]);
  }

  /**
   * @param {number} agentType
   * @param {number} reagentType
   * @returns {[number, number, string?] | undefined} productType and byproductType
   */
  function craft(agentType, reagentType) {
    let formula = craftingFormulae.get(
      agentType * itemTypes.length + reagentType,
    );
    if (formula !== undefined) {
      return formula;
    }
    formula = craftingFormulae.get(reagentType * itemTypes.length + agentType);
    if (formula !== undefined) {
      return formula;
    }
    return undefined;
  }

  /**
   * @typedef {Object} BumpKeyParameters
   * @property {number} agentType
   * @property {number} patientType
   * @property {number} leftType
   * @property {number} rightType,
   * @property {number} effectType,
   */

  /**
   * @typedef {Object} HandlerParameters
   * @property {number} agent
   * @property {number} patient
   * @property {number} direction
   * @property {number} destination
   */

  /**
   * @callback Handler
   * @param {Kit} kit
   * @param {HandlerParameters} params
   */

  /**
   * @callback Verb
   * @param {[number, number?]} itemTypeNames
   * @returns {Handler}
   */

  /** @type {Record<string, Verb>} */
  const verbs = {
    take([yieldType]) {
      /** @type {Handler} */
      function takeHandler(kit, { agent, patient, direction, destination }) {
        kit.put(agent, 0, yieldType);
        kit.macroViewModel.take(
          patient,
          (direction * quarturnToOcturn + halfOcturn) % fullOcturn,
        );
        kit.destroyEntity(patient, destination);
      }
      return takeHandler;
    },

    reap([yieldType]) {
      /** @type {Handler} */
      function reapHandler(kit, { agent, patient, destination }) {
        kit.put(agent, 1, yieldType);
        kit.macroViewModel.fell(patient);
        kit.destroyEntity(patient, destination);
      }
      return reapHandler;
    },

    cut([yieldType]) {
      /** @type {Handler} */
      function cutHandler(kit, { agent }) {
        kit.put(agent, 1, yieldType);
      }
      return cutHandler;
    },

    pick([yieldType]) {
      /** @type {Handler} */
      function cutHandler(kit, { agent }) {
        kit.put(agent, 0, yieldType);
      }
      return cutHandler;
    },

    split([leftType, rightType]) {
      /** @type {Handler} */
      function splitHandler(kit, { agent }) {
        assertDefined(rightType);
        kit.put(agent, 0, leftType);
        kit.put(agent, 1, rightType);
      }
      return splitHandler;
    },

    merge([changeType]) {
      /** @type {Handler} */
      function mergeHandler(kit, { agent }) {
        kit.put(agent, 0, changeType);
        kit.put(agent, 1, itemTypesByName.empty);
      }
      return mergeHandler;
    },

    replace([yieldType]) {
      /** @type {Handler} */
      function replaceHandler(kit, { agent }) {
        kit.put(agent, 0, yieldType);
      }
      return replaceHandler;
    },
  };

  /**
   * @param {BumpKeyParameters} parameters
   */
  function bumpKey({
    agentType,
    patientType,
    leftType,
    rightType,
    effectType,
  }) {
    let key = 0;
    let factor = 1;

    key += agentType;
    factor *= agentTypes.length;

    key += patientType * factor;
    factor *= agentTypes.length;

    key += leftType * factor;
    factor *= itemTypes.length;

    key += rightType * factor;
    factor *= itemTypes.length;

    key += effectType * factor;
    return key;
  }

  /**
   * @param {Kit} kit
   * @param {BumpKeyParameters & HandlerParameters} parameters
   */
  function bumpCombination(kit, parameters) {
    const key = bumpKey(parameters);
    const match = bumpingFormulae.get(key);
    if (match !== undefined) {
      const { handler } = match;
      handler(kit, parameters);
      return match;
    }
    return null;
  }

  /**
   * @param {Kit} kit
   * @param {HandlerParameters} parameters
   */
  function bump(kit, parameters) {
    const agentType = kit.entityType(parameters.agent);
    const patientType = kit.entityType(parameters.patient);
    const agentEffectType = kit.entityEffect(parameters.agent);
    const left = kit.inventory(parameters.agent, 0);
    const right = kit.inventory(parameters.agent, 1);
    for (const effectType of [agentEffectType, effectTypesByName.any]) {
      for (const rightType of [right, itemTypesByName.any]) {
        for (const leftType of [left, itemTypesByName.any]) {
          const match = bumpCombination(kit, {
            ...parameters,
            agentType,
            patientType,
            leftType,
            rightType,
            effectType,
          });
          if (match !== null) {
            return match;
          }
        }
      }
    }
    return null;
  }

  /**
   * @param {Array<{name: string}>} array
   */
  const indexByName = array =>
    Object.fromEntries(array.map(({ name }, i) => [name, i]));

  const tileTypesByName = indexByName(tileTypes);
  const agentTypesByName = indexByName(agentTypes);
  const itemTypesByName = indexByName(itemTypes);
  const effectTypesByName = indexByName(effectTypes);

  /**
   * @param {Array<{name: string, tile?: string}>} array
   */
  const indexTileType = array =>
    array.map(({ name, tile }) => tileTypesByName[tile || name]);

  const defaultTileTypeForAgentType = indexTileType(agentTypes);
  const tileTypeForItemType = indexTileType(itemTypes);
  const tileTypeForEffectType = indexTileType(effectTypes);

  const viewText = tileTypes.map(type => type.text);

  const craftingFormulae = new Map();
  const bumpingFormulae = new Map();

  for (const { agent, reagent, product, byproduct, dialog } of recipes) {
    registerRecipe(agent, reagent, product, byproduct, dialog);
  }

  for (const action of actions) {
    const {
      agent = 'player',
      patient,
      left = 'empty',
      right = 'empty',
      effect = 'any',
      verb,
      items = [],
      dialog,
    } = action;

    const productType = itemTypesByName[items[0]];
    assertDefined(productType, items[0]);
    const byproductType = itemTypesByName[items[1]];
    const makeVerb = verbs[verb];
    assertDefined(makeVerb);
    const handler = makeVerb([productType, byproductType]);

    const agentType = agentTypesByName[agent];
    assertDefined(agentType, agent);
    const patientType = agentTypesByName[patient];
    assertDefined(patientType, patient);
    const leftType = itemTypesByName[left];
    assertDefined(leftType, left);
    const rightType = itemTypesByName[right];
    assertDefined(rightType, right);
    const effectType = effectTypesByName[effect];
    assertDefined(effectType, `Effect does not exist for name: ${effect}`);

    const key = bumpKey({
      agentType,
      patientType,
      leftType,
      rightType,
      effectType,
    });

    bumpingFormulae.set(key, { handler, dialog });
  }

  // Cross-reference agent modes.
  const tileTypeForAgentTypePrograms = agentTypes.map(agentDesc => {
    const { modes } = agentDesc;
    if (modes !== undefined) {
      return modes.map(
        ({ tile, has, holds, hot, cold, sick, immersed, dead }) => {
          const tileType = assumeDefined(
            tileTypesByName[tile],
            `No  tile type for name ${tile} for agent ${agentDesc.name}`,
          );
          /** @type {Array<Condition>}} */
          const conditions = [];
          if (has !== undefined) {
            conditions.push({
              has: true,
              item: assumeDefined(
                itemTypesByName[has],
                `No item type for name ${has} for agent modes of ${agentDesc.name}`,
              ),
            });
          }
          if (holds !== undefined) {
            conditions.push({
              holds: true,
              item: assumeDefined(
                itemTypesByName[holds],
                `No item type for name ${holds} for agent modes of ${agentDesc.name}`,
              ),
            });
          }
          if (hot) {
            conditions.push({ hot: true });
          }
          if (cold) {
            conditions.push({ cold: true });
          }
          if (sick) {
            conditions.push({ sick: true });
          }
          if (immersed) {
            conditions.push({ immersed: true });
          }
          if (dead) {
            conditions.push({ dead: true });
          }
          return {
            tileType,
            conditions,
          };
        },
      );
    }
    return [];
  });

  /**
   * @param {number} agent
   * @param {Kit} kit
   */
  function tileTypeForAgent(agent, kit) {
    const agentType = kit.entityType(agent);
    const program = assumeDefined(tileTypeForAgentTypePrograms[agentType]);
    let tileType = defaultTileTypeForAgentType[agentType];
    for (const statement of program) {
      const { tileType: betterTileType, conditions } = statement;
      if (
        conditions.every(condition => {
          if ('item' in condition) {
            assertDefined(condition.item);
            if ('holds' in condition) {
              return kit.holds(agent, condition.item);
            } else if ('has' in condition) {
              return kit.has(agent, condition.item);
            }
          } else if ('hot' in condition) {
            return kit.hot(agent);
          } else if ('cold' in condition) {
            return kit.cold(agent);
          } else if ('sick' in condition) {
            return kit.sick(agent);
          } else if ('immersed' in condition) {
            return kit.immersed(agent);
          } else if ('dead' in condition) {
            return kit.dead(agent);
          }
          return false;
        })
      ) {
        tileType = betterTileType;
      }
    }
    return tileType;
  }

  return {
    agentTypes,
    itemTypes,
    tileTypes,
    effectTypes,
    tileTypesByName,
    agentTypesByName,
    itemTypesByName,
    effectTypesByName,
    tileTypeForAgent,
    defaultTileTypeForAgentType, // TODO deprecate for tileTypeForAgent
    tileTypeForItemType,
    tileTypeForEffectType,
    craft,
    bump,
    viewText,
  };
}
