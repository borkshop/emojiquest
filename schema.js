/**
 * @template T
 * @typedef {import('./lib/schema.js').SchemaTo<T>} SchemaTo
 */

/** @type {<T>(t: SchemaTo<T>) => T} */
export const Point = $ =>
  $.struct({
    x: $.number(),
    y: $.number(),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WorldColors = $ =>
  $.struct({
    base: $.string(),
    lava: $.string(),
    water: $.string(),
    earth: $.string(),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WorldMechanicsDescription = $ =>
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
          jump: $.optional($.string()),
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
  player: $.optional($.number()),
  locations: $.list($.number()),
  types: $.list($.number()),
  inventories: $.optional($.index($.list($.number()))),
  terrain: $.optional($.list($.number())),
  healths: $.optional($.index($.number())),
  staminas: $.optional($.index($.number())),
  targetLocations: $.optional($.index($.number())),
  targetEntities: $.optional($.index($.number())),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WorldDescription = $ => $.struct(worldFields($));

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const daiaLevelFields = $ => ({
  facetsPerFace: $.number(),
  tilesPerFacet: $.number(),
  colors: $.list(WorldColors($)),
});

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const rectLevelFields = $ => ({
  size: Point($),
  colors: WorldColors($),
});

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const torusLevelFields = $ => ({
  tilesPerChunk: Point($),
  chunksPerLevel: Point($),
  colors: WorldColors($),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WholeWorldDescription = $ =>
  $.struct({
    colors: $.dict($.string()),
    levels: $.list(
      $.choice('topology', {
        rect: rectLevelFields($),
        torus: torusLevelFields($),
        daia: daiaLevelFields($),
      }),
    ),
    ...worldFields($),
    mechanics: WorldMechanicsDescription($),
    marks: $.optional($.dict($.number())),
  });
