/**
 * The mechanics module captures the mechanical elements of the Emoji Quest
 * game, providing indexes into the game's data tables for entity types and
 * formulae.
 */

// @ts-check

import {assertDefined} from './assert.js';
import {halfOcturn, fullOcturn, quarturnToOcturn} from './geometry2d.js';

/**
 * @typedef {{
 *   name: string,
 *   tile?: string,
 *   wanders?: string,
 *   dialog?: Array<string>,
 * }} AgentType
 */

/**
 * @typedef {{
 *   name: string,
 *   tile?: string,
 *   comestible?: boolean,
 *   effect?: string,
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
 * @typedef {ReturnType<makeMechanics>} Mechanics
 */
/**
 * @param {Object} args
 * @param {Array<Recipe>} [args.recipes]
 * @param {Array<Action>} [args.actions]
 * @param {Array<TileType>} [args.tileTypes]
 * @param {Array<AgentType>} [args.validAgentTypes]
 * @param {Array<ItemType>} [args.validItemTypes]
 * @param {Array<EffectType>} [args.effectTypes]
 */
export function makeMechanics({
  recipes = [],
  actions = [],
  tileTypes = [],
  validAgentTypes = [],
  validItemTypes = [],
  effectTypes = [],
} = {}) {

  const agentTypes = [
    { name: 'invalid' },
    { name: 'empty' },
    { name: 'any' },
    ...validAgentTypes
  ];

  const itemTypes = [
    { name: 'invalid' },
    { name: 'empty' },
    { name: 'any' },
    ...validItemTypes
  ];

  /**
   * @param {string} agent
   * @param {string} reagent
   * @param {string} product
   * @param {string} [byproduct]
   * @param {string} [dialog]
   */
  function registerRecipe(agent, reagent, product, byproduct = 'empty', dialog) {
    const agentType = itemTypesByName[agent];
    const reagentType = itemTypesByName[reagent];
    const productType = itemTypesByName[product];
    const byproductType = itemTypesByName[byproduct];
    assertDefined(agentType, `agent item type not defined ${agent}`);
    assertDefined(reagentType, `reeagent item type not defined ${reagent}`);
    assertDefined(productType, `product item type not defined ${product}`);
    assertDefined(byproductType, `byproduct item type not defined ${byproduct}`);
    craftingFormulae.set(agentType * itemTypes.length + reagentType, [
      productType,
      byproductType,
      dialog,
    ]);
  }

  /**
   * @param {number} agentType
   * @param {number} reagentType
   * @returns {[number, number, string?]} productType and byproductType
   */
  function craft(agentType, reagentType) {
    let formula = craftingFormulae.get(agentType * itemTypes.length + reagentType);
    if (formula !== undefined) {
      return formula;
    }
    formula = craftingFormulae.get(reagentType * itemTypes.length + agentType);
    if (formula !== undefined) {
      return formula;
    }
    return [itemTypesByName.poop, itemTypesByName.empty, '💩 These items do not combine.'];
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
      function takeHandler(kit, {agent, patient, direction, destination}) {
        const inventory = kit.entityInventory(agent);
        inventory[0] = yieldType;
        kit.macroViewModel.take(patient, (direction * quarturnToOcturn + halfOcturn) % fullOcturn);
        kit.destroyEntity(patient, destination);
      }
      return takeHandler;
    },

    reap([yieldType]) {
      /** @type {Handler} */
      function reapHandler(kit, { agent, patient, direction, destination }) {
        const inventory = kit.entityInventory(agent);
        inventory[1] = yieldType;
        kit.macroViewModel.bounce(agent, direction * quarturnToOcturn);
        kit.macroViewModel.fell(patient);
        kit.destroyEntity(patient, destination);
      }
      return reapHandler;
    },

    cut([yieldType]) {
      /** @type {Handler} */
      function cutHandler(kit, {agent, direction}) {
        const inventory = kit.entityInventory(agent);
        inventory[1] = yieldType;
        kit.macroViewModel.bounce(agent, direction * quarturnToOcturn);
      }
      return cutHandler;
    },

    pick([yieldType]) {
      /** @type {Handler} */
      function cutHandler(kit, {agent, direction}) {
        const inventory = kit.entityInventory(agent);
        inventory[0] = yieldType;
        kit.macroViewModel.bounce(agent, direction * quarturnToOcturn);
      }
      return cutHandler;
    },

    split([leftType, rightType]) {
      /** @type {Handler} */
      function splitHandler(kit, {agent}) {
        const inventory = kit.entityInventory(agent);
        assertDefined(rightType);
        inventory[0] = leftType;
        inventory[1] = rightType;
      }
      return splitHandler;
    },

    merge([changeType]) {
      /** @type {Handler} */
      function mergeHandler(kit, {agent}) {
        const inventory = kit.entityInventory(agent);
        inventory[0] = changeType;
        inventory[1] = itemTypesByName.empty;
      }
      return mergeHandler;
    },

    replace([yieldType]) {
      /** @type {Handler} */
      function replaceHandler(kit, {agent, direction}) {
        const inventory = kit.entityInventory(agent);
        inventory[0] = yieldType;
        kit.macroViewModel.bounce(agent, direction * quarturnToOcturn);
      }
      return replaceHandler;
    },
  };

  /**
   * @param {BumpKeyParameters} parameters
   */
  function bumpKey({agentType, patientType, leftType, rightType, effectType}) {
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
      console.table({
        agentType: agentTypes[parameters.agentType].name,
        patientType: agentTypes[parameters.patientType].name,
        leftType: itemTypes[parameters.leftType].name,
        rightType: itemTypes[parameters.rightType].name,
        effectType: effectTypes[parameters.effectType].name,
      });
      const {handler} = match;
      handler(kit, parameters);
      return match;
    }
    return null;
  }

  /**
   * @typedef {Object} Kit
   * @property {(entity: number) => number} entityType
   * @property {(entity: number) => number} entityEffect
   * @property {(entity: number) => Array<number>} entityInventory
   * @property {import('./macro-view-model.js').MacroViewModel} macroViewModel
   * @property {(entity: number, location: number) => void} destroyEntity
   */

  /**
   * @param {Kit} kit
   * @param {HandlerParameters} parameters
   */
  function bump(kit, parameters) {
    const agentType = kit.entityType(parameters.agent);
    const patientType = kit.entityType(parameters.patient);
    const agentEffectType = kit.entityEffect(parameters.agent);
    const inventory = kit.entityInventory(parameters.agent);
    const [left, right] = inventory;
    for (const effectType of [agentEffectType, effectTypesByName.any]) {
      for (const rightType of [right, itemTypesByName.any]) {
        for (const leftType of [left, itemTypesByName.any]) {
          const match = bumpCombination(kit, {...parameters, agentType, patientType, leftType, rightType, effectType})
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
  const indexByName = array => Object.fromEntries(array.map(({ name }, i) => [name, i]));

  const tileTypesByName = indexByName(tileTypes);
  const agentTypesByName = indexByName(agentTypes);
  const itemTypesByName = indexByName(itemTypes);
  const effectTypesByName = indexByName(effectTypes);

  /**
   * @param {Array<{name: string, tile?: string}>} array
   */
  const indexTileType = array => array.map(({ name, tile }) => tileTypesByName[tile || name]);

  const defaultTileTypeForAgentType = indexTileType(agentTypes);
  const tileTypeForItemType = indexTileType(itemTypes);
  const tileTypeForEffectType = indexTileType(effectTypes);

  const viewText = tileTypes.map(type => type.text);

  const craftingFormulae = new Map();
  const bumpingFormulae = new Map();

  for (const {agent, reagent, product, byproduct, dialog} of recipes) {
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
    assertDefined(effectType, effect);

    const key = bumpKey({
      agentType,
      patientType,
      leftType,
      rightType,
      effectType,
    });

    bumpingFormulae.set(key, {handler, dialog});
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
    defaultTileTypeForAgentType,
    tileTypeForItemType,
    tileTypeForEffectType,
    craft,
    bump,
    viewText,
  };
}
