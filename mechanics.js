/**
 * The mechanics module captures the mechanical elements of the Emoji Quest
 * game, providing indexes into the game's data tables for entity types and
 * formulae.
 */

// @ts-check

import { assert, assertDefined, assumeDefined } from './lib/assert.js';
import { heldSlot, packSlot } from './model.js';

/** @typedef {import('./types.js').AdvanceFn} AdvanceFn */

/** @type {{[name: string]: number}} */
const builtinTileTypesByName = Object.assign(Object.create(null), {
  invalid: -2,
  empty: -3,
  any: -4,
});

/**
 * @typedef {import('./schema-types.js').AgentDescription} AgentDescription
 * @typedef {import('./schema-types.js').ConditionDescription} ConditionDescription
 * @typedef {import('./schema-types.js').ItemDescription} ItemDescription
 * @typedef {import('./schema-types.js').TileDescription} TileDescription
 * @typedef {import('./schema-types.js').RecipeDescription} RecipeDescription
 * @typedef {import('./schema-types.js').ActionDescription} ActionDescription
 * @typedef {import('./schema-types.js').EffectDescription} EffectDescription
 * @typedef {import('./schema-types.js').MechanicsDescription} MechanicsDescription
 * @typedef {import('./types.js').ModelKit} ModelKit
 * @typedef {import('./types.js').ActionTypeParameters} ActionTypeParameters
 * @typedef {import('./types.js').ActionHandler} ActionHandler
 * @typedef {import('./types.js').ActionParameters} ActionParameters
 */

/**
 * @callback Verb
 * @param {[number, number?]} itemTypeNames
 * @returns {ActionHandler}
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
  /** @type {Array<AgentDescription>} */
  const agentTypes = [
    ...specialDescriptions,
    ...worldAgentTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<ItemDescription>} */
  const itemTypes = [
    ...specialDescriptions,
    ...worldItemTypes.filter(desc => !specialNames.includes(desc.name)),
  ];

  /** @type {Array<EffectDescription>} */
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
      /** @type {ActionHandler} */
      function touchHandler() {}
      return touchHandler;
    },

    take([yieldType]) {
      /** @type {ActionHandler} */
      function takeHandler(kit, { agent, patient, direction, destination }) {
        kit.put(agent, 0, yieldType);
        kit.take(patient, direction, destination);
      }
      return takeHandler;
    },

    give([]) {
      /** @type {ActionHandler} */
      function giveHandler(kit, { agent }) {
        kit.put(agent, 0, itemTypesByName.empty);
      }
      return giveHandler;
    },

    reap([yieldType]) {
      /** @type {ActionHandler} */
      function reapHandler(kit, { agent, patient, destination }) {
        kit.put(agent, 1, yieldType);
        kit.fell(patient, destination);
      }
      return reapHandler;
    },

    cut(yieldTypes) {
      /** @type {ActionHandler} */
      function cutHandler(kit, { agent }) {
        for (const yieldType of yieldTypes) {
          if (yieldType !== undefined) {
            if (kit.inventory(agent, 0) === itemTypesByName.empty) {
              kit.put(agent, 0, yieldType);
            } else if (kit.inventory(agent, 1) === itemTypesByName.empty) {
              kit.put(agent, 1, yieldType);
            }
          }
        }
      }
      return cutHandler;
    },

    pick([leftYieldType, rightYieldType]) {
      /** @type {ActionHandler} */
      function cutHandler(kit, { agent }) {
        const actionHasLeftYieldType = leftYieldType !== undefined;
        const actionHasRightYieldType = rightYieldType !== undefined;
        const agentCanHoldLeftItem =
          kit.inventory(agent, 0) === itemTypesByName.empty;
        const agentCanHoldRightItem =
          kit.inventory(agent, 1) === itemTypesByName.empty;
        if (
          (actionHasLeftYieldType && !agentCanHoldLeftItem) ||
          (actionHasRightYieldType && !agentCanHoldRightItem)
        ) {
          console.warn(
            'Invalid pick mechanic: hands must be empty for corresponding items',
            {
              actionHasLeftYieldType,
              actionHasRightYieldType,
              agentCanHoldLeftItem,
              agentCanHoldRightItem,
            },
          );
        } else {
          if (leftYieldType !== undefined) {
            kit.put(agent, 0, leftYieldType);
          }
          if (rightYieldType !== undefined) {
            kit.put(agent, 1, rightYieldType);
          }
        }
      }
      return cutHandler;
    },

    exchange([leftYieldType, rightYieldType]) {
      /** @type {ActionHandler} */
      function cutHandler(kit, { agent }) {
        if (leftYieldType !== undefined) {
          kit.put(agent, 0, leftYieldType);
        }
        if (rightYieldType !== undefined) {
          kit.put(agent, 1, rightYieldType);
        }
      }
      return cutHandler;
    },

    split([leftType, rightType]) {
      /** @type {ActionHandler} */
      function splitHandler(kit, { agent }) {
        assertDefined(rightType);
        kit.put(agent, 0, leftType);
        kit.put(agent, 1, rightType);
      }
      return splitHandler;
    },

    merge([changeType]) {
      /** @type {ActionHandler} */
      function mergeHandler(kit, { agent }) {
        kit.put(agent, 0, changeType);
        kit.put(agent, 1, itemTypesByName.empty);
      }
      return mergeHandler;
    },

    replace([leftYieldType, rightYieldType]) {
      /** @type {ActionHandler} */
      function replaceHandler(kit, { agent }) {
        if (leftYieldType !== undefined) {
          kit.put(agent, 0, leftYieldType);
        }
        if (rightYieldType !== undefined) {
          kit.put(agent, 1, rightYieldType);
        }
      }
      return replaceHandler;
    },

    grow([yieldType]) {
      /** @type {ActionHandler} */
      function growHandler(kit, { agent }) {
        kit.put(agent, 0, yieldType);
      }
      return growHandler;
    },

    // XXX Coordinate new verbs with validator in file.js.
  };

  /**
   * @param {ActionTypeParameters} parameters
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
   * @param {ActionTypeParameters} parameters
   */
  function bumpCombination(parameters) {
    const key = bumpKey(parameters);
    return bumpingFormulae.get(key);
  }

  /**
   * @param {ModelKit} kit
   * @param {ActionParameters} parameters
   */
  function bump(kit, parameters) {
    const agentType = kit.entityType(parameters.agent);
    const patientType = kit.entityType(parameters.patient);
    const agentEffectType = kit.entityEffect(parameters.agent);
    const leftType = kit.inventory(parameters.agent, 0);
    const rightType = kit.inventory(parameters.agent, 1);
    for (const effectType of [agentEffectType, effectTypesByName.any]) {
      let match = bumpCombination({
        agentType,
        patientType,
        leftType,
        rightType,
        effectType,
      });
      if (match !== undefined) {
        return match;
      }

      match = bumpCombination({
        agentType,
        patientType,
        leftType,
        rightType: itemTypesByName.any,
        effectType,
      });
      if (match !== undefined) {
        return match;
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
      morph,
      shift,
      dialog,
      jump,
    } = action;

    const productType = itemTypesByName[items[0]];
    const byproductType = itemTypesByName[items[1]];
    const morphType = morph === undefined ? undefined : agentTypesByName[morph];
    assert(morph === undefined || typeof morphType === 'number');
    const shiftType = shift === undefined ? undefined : agentTypesByName[shift];
    assert(shift === undefined || typeof shiftType === 'number');
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

    bumpingFormulae.set(key, { handler, dialog, jump, morphType, shiftType });
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
          /** @type {Array<import('./types.js').Condition>}} */
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
   * @param {ModelKit} kit
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
