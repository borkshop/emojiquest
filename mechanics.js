/**
 * The mechanics module captures the mechanical elements of the Emoji Quest
 * game, providing indexes into the game's data tables for entity types and
 * formulae.
 */

// @ts-check

import {assertDefined} from './assert.js';
import {halfOcturn, fullOcturn, quarturnToOcturn} from './geometry2d.js';
import {tileTypes, agentTypes, itemTypes, effectTypes, actions, recipes} from './data.js';
export {tileTypes, agentTypes, itemTypes, effectTypes} from './data.js';

/**
 * @param {Array<{name: string}>} array
 */
const indexByName = array => Object.fromEntries(array.map(({ name }, i) => [name, i]));

export const tileTypesByName = indexByName(tileTypes);
export const agentTypesByName = indexByName(agentTypes);
export const itemTypesByName = indexByName(itemTypes);
export const effectTypesByName = indexByName(effectTypes);

/**
 * @param {Array<{name: string, tile?: string}>} array
 */
const indexTileType = array => array.map(({ name, tile }) => tileTypesByName[tile || name]);

export const defaultTileTypeForAgentType = indexTileType(agentTypes);
export const tileTypeForItemType = indexTileType(itemTypes);
export const tileTypeForEffectType = indexTileType(effectTypes);

export const viewText = tileTypes.map(type => type.text);

const craftingFormulae = new Map();

/**
 * @param {string} agent
 * @param {string} reagent
 * @param {string} product
 * @param {string} byproduct
 */
export function registerRecipe(agent, reagent, product, byproduct = 'empty') {
  const agentType = itemTypesByName[agent];
  const reagentType = itemTypesByName[reagent];
  const productType = itemTypesByName[product];
  const byproductType = itemTypesByName[byproduct];
  assertDefined(agentType, `agent item type not defined ${agent}`);
  assertDefined(reagentType, `reeagent item type not defined ${reagent}`);
  assertDefined(productType, `product item type not defined ${product}`);
  assertDefined(byproductType, `byproduct item type not defined ${byproduct}`);
  craftingFormulae.set(agentType * itemTypes.length + reagentType, [productType, byproductType]);
}

for (const [agent, reagent, product, byproduct] of recipes) {
  registerRecipe(agent, reagent, product, byproduct);
}

/**
 * @param {number} agentType
 * @param {number} reagentType
 * @returns {[number, number]} productType and byproductType
 */
export function craft(agentType, reagentType) {
  let productTypes = craftingFormulae.get(agentType * itemTypes.length + reagentType);
  if (productTypes !== undefined) {
    return productTypes;
  }
  productTypes = craftingFormulae.get(reagentType * itemTypes.length + agentType);
  if (productTypes !== undefined) {
    return productTypes;
  }
  return [itemTypesByName.poop, itemTypesByName.empty];
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

const bumpingFormulae = new Map();

for (const [agent, patient, left, right, effect, verb, items] of actions) {
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

  bumpingFormulae.set(key, handler);
}

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
  const handler = bumpingFormulae.get(key);
  if (handler !== undefined) {
    console.table({
      agentType: agentTypes[parameters.agentType].name,
      patientType: agentTypes[parameters.patientType].name,
      leftType: itemTypes[parameters.leftType].name,
      rightType: itemTypes[parameters.rightType].name,
      effectType: effectTypes[parameters.effectType].name,
    });
    handler(kit, parameters);
    return true;
  }
  return false;
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
export function bump(kit, parameters) {
  const agentType = kit.entityType(parameters.agent);
  const patientType = kit.entityType(parameters.patient);
  const agentEffectType = kit.entityEffect(parameters.agent);
  const inventory = kit.entityInventory(parameters.agent);
  const [left, right] = inventory;
  for (const effectType of [agentEffectType, effectTypesByName.any]) {
    for (const rightType of [right, itemTypesByName.any]) {
      for (const leftType of [left, itemTypesByName.any]) {
        if (bumpCombination(kit, {...parameters, agentType, patientType, leftType, rightType, effectType})) {
          return;
        }
      }
    }
  }
}
