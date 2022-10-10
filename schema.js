/** @template T
 * @typedef {import('./lib/schema.js').Schema<T>} Schema
 */

import { rect } from './topology/rect/schema.js';
import { torus } from './topology/torus/schema.js';
import { daia } from './topology/daia/schema.js';

/**
 * @template T
 * @param {Schema<T>} $
 */
export const pointSchema = $ =>
  $.struct({
    x: $.number(),
    y: $.number(),
  });

/**
 * @template T
 * @param {Schema<T>} $
 */
export const colorsSchema = $ =>
  $.struct({
    base: $.string(),
    lava: $.string(),
    water: $.string(),
    earth: $.string(),
  });

/**
 * @template T
 * @param {Schema<T>} $
 */
export const mechanicsSchema = $ =>
  $.struct({
    agentTypes: $.list(
      $.struct({
        name: $.string(),
        tile: $.optional($.string()),
        wanders: $.optional($.string()),
        dialog: $.optional($.list($.string())),
        health: $.optional($.number()),
        stamina: $.optional($.number()),
        modes: $.optional(
          $.list(
            $.struct({
              tile: $.string(),
              holds: $.optional($.string()),
              has: $.optional($.string()),
              hot: $.optional($.boolean()),
              cold: $.optional($.boolean()),
              sick: $.optional($.boolean()),
              health: $.optional($.number()),
              stamina: $.optional($.number()),
              immersed: $.optional($.boolean()),
            }),
          ),
        ),
        slots: $.optional(
          $.list(
            $.struct({
              tile: $.string(),
              held: $.optional($.boolean()),
              pack: $.optional($.boolean()),
            }),
          ),
        ),
      }),
    ),
    recipes: $.list(
      $.struct({
        agent: $.string(),
        reagent: $.string(),
        product: $.string(),
        byproduct: $.optional($.string()),
        price: $.optional($.number()),
        dialog: $.optional($.string()),
      }),
    ),
    actions: $.list(
      $.struct({
        agent: $.optional($.string()),
        patient: $.string(),
        left: $.optional($.string()),
        right: $.optional($.string()),
        effect: $.optional($.string()),
        verb: $.string(),
        items: $.list($.string()),
        dialog: $.optional($.string()),
      }),
    ),
    tileTypes: $.list(
      $.struct({
        name: $.string(),
        text: $.string(),
        turn: $.optional($.number()),
      }),
    ),
    itemTypes: $.list(
      $.struct({
        name: $.string(),
        tile: $.optional($.string()),
        comestible: $.optional($.boolean()),
        health: $.optional($.number()),
        stamina: $.optional($.number()),
        heat: $.optional($.number()),
        boat: $.optional($.boolean()),
        swimGear: $.optional($.boolean()),
        tip: $.optional($.string()),
        slot: $.optional($.string()),
      }),
    ),
    effectTypes: $.list(
      $.struct({
        name: $.string(),
        tile: $.optional($.string()),
      }),
    ),
  });

/**
 * @template T
 * @param {Schema<T>} $
 */
const worldFields = $ => ({
  colors: $.dict($.string()),
  levels: $.list(
    $.choice('topology', {
      rect: rect($),
      torus: torus($),
      daia: daia($),
    }),
  ),
  player: $.optional($.number()),
  locations: $.list($.number()),
  types: $.list($.number()),
  inventories: $.list(
    $.struct({
      entity: $.number(),
      inventory: $.list($.number()),
    }),
  ),
  terrain: $.list($.number()),
  healths: $.list(
    $.struct({
      entity: $.number(),
      health: $.number(),
    }),
  ),
  staminas: $.list(
    $.struct({
      entity: $.number(),
      stamina: $.number(),
    }),
  ),
  entityTargetLocations: $.list(
    $.struct({
      entity: $.number(),
      location: $.number(),
    }),
  ),
});

/**
 * @template T
 * @param {Schema<T>} $
 */
export const worldSchema = $ => $.struct(worldFields($));

/**
 * @template T
 * @param {Schema<T>} $
 */

export const wholeWorldSchema = $ =>
  $.struct({
    ...worldFields($),
    mechanics: mechanicsSchema($),
  });
