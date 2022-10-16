/**
 * @template T
 * @typedef {import('./lib/schema.js').SchemaTo<T>} SchemaTo
 */

import { rect } from './topology/rect/schema.js';
import { torus } from './topology/torus/schema.js';
import { daia } from './topology/daia/schema.js';

/** @type {<T>(t: SchemaTo<T>) => T} */
export const pointSchema = $ =>
  $.struct({
    x: $.number(),
    y: $.number(),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const colorsSchema = $ =>
  $.struct({
    base: $.string(),
    lava: $.string(),
    water: $.string(),
    earth: $.string(),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
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
    recipes: $.optional(
      $.list(
        $.struct({
          agent: $.string(),
          reagent: $.string(),
          product: $.string(),
          byproduct: $.optional($.string()),
          price: $.optional($.number()),
          dialog: $.optional($.string()),
        }),
      ),
    ),
    actions: $.optional(
      $.list(
        $.struct({
          agent: $.optional($.string()),
          patient: $.string(),
          left: $.optional($.string()),
          right: $.optional($.string()),
          effect: $.optional($.string()),
          verb: $.string(),
          items: $.optional($.list($.string())),
          dialog: $.optional($.string()),
        }),
      ),
    ),
    tileTypes: $.list(
      $.struct({
        name: $.string(),
        text: $.string(),
        turn: $.optional($.number()),
      }),
    ),
    itemTypes: $.optional(
      $.list(
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
    ),
    effectTypes: $.optional(
      $.list(
        $.struct({
          name: $.string(),
          tile: $.optional($.string()),
        }),
      ),
    ),
  });

/**
 * @template T
 * @param {SchemaTo<T>} $
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
  inventories: $.optional(
    $.list(
      $.struct({
        entity: $.number(),
        inventory: $.list($.number()),
      }),
    ),
  ),
  terrain: $.optional($.list($.number())),
  healths: $.optional(
    $.list(
      $.struct({
        entity: $.number(),
        health: $.number(),
      }),
    ),
  ),
  staminas: $.optional(
    $.list(
      $.struct({
        entity: $.number(),
        stamina: $.number(),
      }),
    ),
  ),
  entityTargetLocations: $.optional(
    $.list(
      $.struct({
        entity: $.number(),
        location: $.number(),
      }),
    ),
  ),
  entityTargetEntities: $.optional(
    $.list(
      $.struct({
        from: $.number(),
        to: $.number(),
      }),
    ),
  ),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const worldSchema = $ => $.struct(worldFields($));

/** @type {<T>(t: SchemaTo<T>) => T} */
export const wholeWorldSchema = $ =>
  $.struct({
    ...worldFields($),
    mechanics: mechanicsSchema($),
  });
