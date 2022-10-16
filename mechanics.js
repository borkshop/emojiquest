/**
 * The mechanics module captures the mechanical elements of the Emoji Quest
 * game, providing indexes into the game's data tables for entity types and
 * formulae.
 */

// @ts-check

import { assertDefined, assumeDefined } from './lib/assert.js';
import { heldSlot, packSlot } from './model.js';

/**
 * @typedef {import('./topology.js').AdvanceFn} AdvanceFn
 */

/** @type {{[name: string]: number}} */
const builtinTileTypesByName = Object.assign(Object.create(null), {
  invalid: -2,
  empty: -3,
  any: -4,
});

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
 *     hot?: boolean,
 *     cold?: boolean,
 *     sick?: boolean,
 *     health?: number,
 *     stamina?: number,
 *     immersed?: boolean,
 *   }>,
 *   slots?: Array<{
 *     tile: string,
 *     held?: boolean,
 *     pack?: boolean,
 *   }>,
 * }} AgentType
 *
 * @typedef {{has: true, item: number} |
 *   {holds: true, item: number} |
 *   {hot: true} |
 *   {cold: true} |
 *   {sick: true} |
 *   {immersed: true} |
 *   {health: number} |
 *   {stamina: number}
 * } Condition
 *
 * @typedef {{
 *   name: string,
 *   tile?: string,
 *   comestible?: boolean,
 *   health?: number,
 *   stamina?: number,
 *   heat?: number,
 *   boat?: boolean,
 *   swimGear?: boolean,
 *   tip?: string,
 *   slot?: string,
 * }} ItemType
 *
 * @typedef {{
 *   name: string,
 *   text: string,
 *   turn?: number,
 * }} TileType
 *
 * @typedef {{
 *   agent: string,
 *   reagent: string,
 *   product: string,
 *   byproduct?: string,
 *   price?: number,
 *   dialog?: string,
 * }} Recipe
 *
 * @typedef {{
 *   agent?: string,
 *   patient: string,
 *   left?: string,
 *   right?: string,
 *   effect?: string,
 *   verb: string,
 *   items?: Array<string>,
 *   dialog?: string,
 *   jump?: string,
 * }} Action
 *
 * @typedef {{
 *   name: string,
 *   tile?: string,
 * }} EffectType
 *
 * @typedef {object} MechanicsDescription
 * @prop {Array<Recipe>} [args.recipes]
 * @prop {Array<Action>} [args.actions]
 * @prop {Array<TileType>} [args.tileTypes]
 * @prop {Array<AgentType>} [args.agentTypes]
 * @prop {Array<ItemType>} [args.itemTypes]
 * @prop {Array<EffectType>} [args.effectTypes]
 *
 * @typedef {Object} Kit
 * @property {(entity: number) => number} entityType
 * @property {(entity: number) => number} entityEffect
 * @property {(entity: number, direction: number, location: number) => void} take
 * @property {(entity: number, location: number) => void} fell
 * @property {(entity: number, slot: number) => number} inventory
 * @property {(entity: number, slot: number, itemType: number) => void} put
 * @property {(entity: number, itemType: number) => boolean} has
 * @property {(entity: number, itemType: number) => boolean} holds
 * @property {(entity: number) => boolean} cold
 * @property {(entity: number) => boolean} hot
 * @property {(entity: number) => boolean} sick
 * @property {(entity: number) => boolean} immersed
 * @property {(entity: number) => number} entityHealth
 * @property {(entity: number) => number} entityStamina
 * @property {AdvanceFn} advance
 */

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

/**
 * @typedef {ReturnType<makeMechanics>} Mechanics
 */

const specialNames = ['invalid', 'empty', 'any'];
const specialDescriptions = specialNames.map(name => ({ name }));

/**
 * @param {MechanicsDescription} mechanicsDescription
 */
export function makeMechanics({
  recipes = [],
  actions = [],
  tileTypes = [],
  agentTypes: worldAgentTypes = [],
  itemTypes: worldItemTypes = [],
  effectTypes: worldEffectTypes = [],
} = {}) {
  /** @type {Array<AgentType>} */
  const agentTypes = [
    ...specialDescriptions,
    ...worldAgentTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<ItemType>} */
  const itemTypes = [
    ...specialDescriptions,
    ...worldItemTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<EffectType>} */
  const effectTypes = [
    ...specialDescriptions,
    ...worldEffectTypes.filter(desc => !specialNames.includes(desc.name)),
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

  // TODO each verb should assert that it receives defined item types for
  // however many items it needs.
  /** @type {Record<string, Verb>} */
  const verbs = {
    touch([]) {
      /** @type {Handler} */
      function touchHandler() {}
      return touchHandler;
    },

    take([yieldType]) {
      /** @type {Handler} */
      function takeHandler(kit, { agent, patient, direction, destination }) {
        kit.put(agent, 0, yieldType);
        kit.take(patient, direction, destination);
      }
      return takeHandler;
    },

    reap([yieldType]) {
      /** @type {Handler} */
      function reapHandler(kit, { agent, patient, destination }) {
        kit.put(agent, 1, yieldType);
        kit.fell(patient, destination);
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

    // XXX Coordinate new verbs with validator in file.js.
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
   * @param {BumpKeyParameters & HandlerParameters} parameters
   */
  function bumpCombination(parameters) {
    const key = bumpKey(parameters);
    return bumpingFormulae.get(key);
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
          const match = bumpCombination({
            ...parameters,
            agentType,
            patientType,
            leftType,
            rightType,
            effectType,
          });
          if (match !== undefined) {
            return match;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * @param {Array<{name: string}>} array
   */
  const indexByName = array =>
    Object.fromEntries(array.map(({ name }, i) => [name, i]));

  const tileTypesByName = indexByName(tileTypes);
  Object.assign(tileTypesByName, builtinTileTypesByName);

  const agentTypesByName = indexByName(agentTypes);
  const itemTypesByName = indexByName(itemTypes);
  const effectTypesByName = indexByName(effectTypes);

  /**
   * @param {Array<{name: string, tile?: string}>} array
   */
  const indexTileType = array =>
    array.map(
      ({ name, tile }) =>
        builtinTileTypesByName[name] || tileTypesByName[tile || name],
    );

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
      jump,
    } = action;

    const productType = itemTypesByName[items[0]];
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

    bumpingFormulae.set(key, { handler, dialog, jump });
  }

  // Cross-reference agent modes.
  const tileTypeForAgentTypePrograms = agentTypes.map(agentDesc => {
    const { modes } = agentDesc;
    if (modes !== undefined) {
      return modes.map(
        ({ tile, has, holds, hot, cold, sick, immersed, health, stamina }) => {
          const tileType = assumeDefined(
            tileTypesByName[tile],
            `No tile type for name ${tile} for agent ${agentDesc.name}`,
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
          if (health !== undefined) {
            conditions.push({ health });
          }
          if (stamina !== undefined) {
            conditions.push({ stamina });
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
          } else if ('health' in condition) {
            return kit.entityHealth(agent) === condition.health;
          } else if ('stamina' in condition) {
            return kit.entityStamina(agent) === condition.stamina;
          }
          return false;
        })
      ) {
        tileType = betterTileType;
      }
    }
    return tileType;
  }

  const tileTypeForAgentSlots = agentTypes.map(agentDesc => {
    const { slots } = agentDesc;
    if (slots === undefined) {
      return [];
    }
    return slots.map(({ tile, held, pack }) => {
      const tileType = assumeDefined(
        tileTypesByName[tile],
        `No slot tile type for name ${tile} for agent ${agentDesc.name}`,
      );
      let slotFlags = 0;
      slotFlags |= held === true ? heldSlot : 0;
      slotFlags |= pack === true ? packSlot : 0;
      return { tileType, slotFlags };
    });
  });

  const nullSlotDesc = { tileType: tileTypesByName.empty, slotFlags: 0 };

  /**
   * @param {number} agentType
   * @param {number} slot
   */
  function describeSlot(agentType, slot) {
    const slots = tileTypeForAgentSlots[agentType];
    if (slot >= slots.length) {
      return nullSlotDesc;
    }
    return slots[slot];
  }

  const agentSlotsByName = agentTypes.map(agentDesc => {
    const { slots } = agentDesc;
    if (slots === undefined) {
      return {};
    }
    return Object.fromEntries(
      slots.map(({ tile }, index) => {
        return [tile, index];
      }),
    );
  });

  /**
   * @param {number} agentType
   * @param {number} itemType
   */
  function slotForItem(agentType, itemType) {
    const itemDesc = assumeDefined(itemTypes[itemType]);
    if (itemDesc.slot === undefined) {
      return undefined;
    }
    const slotsByName = assumeDefined(agentSlotsByName[agentType]);
    return slotsByName[itemDesc.slot];
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
    describeSlot,
    slotForItem,
    tileTypeForItemType,
    tileTypeForEffectType,
    craft,
    bump,
    viewText,
  };
}
