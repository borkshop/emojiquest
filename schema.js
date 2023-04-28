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
export const WorldColorNamePalette = $ =>
  $.struct({
    base: $.string(),
    lava: $.string(),
    water: $.string(),
    earth: $.string(),
  });

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const conditionFields = $ => ({
  holds: $.optional($.string()),
  has: $.optional($.string()),
  hot: $.optional($.boolean()),
  cold: $.optional($.boolean()),
  sick: $.optional($.boolean()),
  health: $.optional($.number()),
  stamina: $.optional($.number()),
  immersed: $.optional($.boolean()),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const ConditionDescription = $ => $.struct(conditionFields($));

/** @type {<T>(t: SchemaTo<T>) => T} */
export const AgentDescription = $ =>
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
          ...conditionFields($),
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
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const ItemDescription = $ =>
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
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const TileDescription = $ =>
  $.struct({
    name: $.string(),
    text: $.string(),
    turn: $.optional($.number()),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const RecipeDescription = $ =>
  $.struct({
    agent: $.string(),
    reagent: $.string(),
    product: $.string(),
    byproduct: $.optional($.string()),
    price: $.optional($.number()),
    dialog: $.optional($.string()),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const ActionDescription = $ =>
  $.struct({
    agent: $.optional($.string()),
    patient: $.string(),
    left: $.optional($.string()),
    right: $.optional($.string()),
    effect: $.optional($.string()),
    verb: $.string(),
    items: $.optional($.list($.string())),
    morph: $.optional($.string()),
    shift: $.optional($.string()),
    dialog: $.optional($.string()),
    jump: $.optional($.string()),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const EffectDescription = $ =>
  $.struct({
    name: $.string(),
    tile: $.optional($.string()),
  });

/** @type {<T>(t: SchemaTo<T>) => T} */
export const MechanicsDescription = $ =>
  $.struct({
    agentTypes: $.optional($.list(AgentDescription($))),
    recipes: $.optional($.list(RecipeDescription($))),
    actions: $.optional($.list(ActionDescription($))),
    tileTypes: $.optional($.list(TileDescription($))),
    itemTypes: $.optional($.list(ItemDescription($))),
    effectTypes: $.optional($.list(EffectDescription($))),
  });

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const worldModelFields = $ => ({
  locations: $.list($.number()),
  types: $.list($.number()),

  player: $.optional($.number()),
  inventories: $.optional($.index($.list($.number()))),
  terrain: $.optional($.uint8array()),
  healths: $.optional($.index($.number())),
  staminas: $.optional($.index($.number())),
  targetLocations: $.optional($.index($.number())),
  targetEntities: $.optional($.index($.number())),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WorldDescription = $ => $.struct(worldModelFields($));

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const daiaLevelFields = $ => ({
  facetsPerFace: $.number(),
  tilesPerFacet: $.number(),
  colors: $.list(WorldColorNamePalette($)),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const DaiaLevelDescription = $ => $.struct(daiaLevelFields($));

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const rectLevelFields = $ => ({
  size: Point($),
  colors: WorldColorNamePalette($),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const RectLevelDescription = $ => $.struct(rectLevelFields($));

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const torusLevelFields = $ => ({
  tilesPerChunk: Point($),
  chunksPerLevel: Point($),
  colors: WorldColorNamePalette($),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const TorusLevelDescription = $ => $.struct(torusLevelFields($));

/** @type {<T>(t: SchemaTo<T>) => T} */
export const LevelDescription = $ =>
  $.choice('topology', {
    rect: rectLevelFields($),
    torus: torusLevelFields($),
    daia: daiaLevelFields($),
  });

/**
 * @template T
 * @param {SchemaTo<T>} $
 */
const worldMetaFields = $ => ({
  colors: $.dict($.string()),
  levels: $.list(LevelDescription($)),
  mechanics: MechanicsDescription($),
  marks: $.optional($.dict($.number())),
});

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WorldMetaDescription = $ => $.struct(worldMetaFields($));

/** @type {<T>(t: SchemaTo<T>) => T} */
export const WholeWorldDescription = $ =>
  $.struct({
    ...worldModelFields($),
    ...worldMetaFields($),
  });
