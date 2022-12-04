import type { Coord, Transition } from './animation2d.js';
import type { Progress, AnimateFn } from './progress.js';

// Informs the view that the animation turn has begun.
export type TickFn = () => void;
// Informs the view that the animation turn has ended.
export type TockFn = () => void;

export type Clock = {
  tick: TickFn;
  tock: TockFn;
  animate: AnimateFn;
};

// A TileCoordinate fully qualifies a coordinate on a possibly multi-faceted
// level.
export type TileCoordinate = {
  t: number; // tile number
  f: number; // face of tile number
  n: number; // row major index of tile on face
  x: number; // horizontal position on face
  y: number; // vertical position on face
};

// A TileCoordinateFn translates a tile number to a fully qualified coordinate
// on a level of a possibly multi-faceted level.
export type TileCoordinateFn = (
  t: number, // tile number
) => TileCoordinate;

// A TileQuery describes a coordinate on a possibly multi-faceted level.
export type TileQuery = {
  f: number; // face number of tile
  x: number; // horizontal position on face
  y: number; // vertical position on face
};

// A TileNumberFn translates a face number and coordinate for a particular
// location to its corresponding position number in the model.
export type TileNumberFn = (query: TileQuery) => number;

// A Cursor describes a location and orientation in the world.
export type Cursor = {
  position: number; // a location number (depending on model topology)
  direction: number; // a direction number (depending again on model topology)
};

// A CursorChange describes a destination and how an entity will get there.
export type CursorChange = Cursor & {
  turn: number; // a change to the cursor direction (in units depending on model topology)
  transit: boolean; // whether the cursor change is discontinuous, jumping to another level or face.
};

// An AdvanceFn indicates what (if any) tile is adjacent to an origin tile and
// how motion to that tile will reorient an entity that passes in that
// direction.
export type AdvanceFn = (cursor: Cursor) => CursorChange | undefined;

// A ToponymFn produces a description of a location in the world, suitable for
// display to an editor to get a sense of where they are in the grand scheme of
// things.
export type ToponymFn = (
  t: number, // tile number
) => string;

export type ModelReadFacet = {
  size: number;
  locate: (entity: number) => number;
  inventory: (entity: number, slot: number) => number;
  allPacked: (entity: number, start?: number) => boolean;
  anyPacked: (entity: number, start?: number) => boolean;
  entityAt: (location: number) => number;
  entityTypeAt: (location: number) => number;
  getTerrainFlags: (location: number) => number;
  entityType: (entity: number) => number;
  entityHealth: (entity: number) => number;
  entityStamina: (entity: number) => number;
  intendToMove: (entity: number, direction: number, repeat?: boolean) => void;
  intendToCraft: (entity: number) => void;
  swap: (entity: number, i: number, j: number) => void;
  use: (entity: number, slot: number) => void;
  follow: (entity: number, follower: ModelFollower) => void;
  unfollow: (entity: number, follower: ModelFollower) => void;
};

export type ModelWriteFacet = {
  remove: (location: number) => void;
  set: (location: number, entityType: number) => number;
  toggleTerrainFlags: (location: number, terrainFlags: number) => void;
  setEntityTargetLocation: (entity: number, location: number) => boolean;
  setEntityTargetEntity: (entity: number, location: number) => boolean;
};

export type ModelFacetForController = ModelReadFacet &
  ModelWriteFacet & {
    tick: TickFn;
    tock: TockFn;
  };

// Simply marks a location as dirty, having changed terrain.
// Watchers are expected to aggregate notifications and read back current flags
// with model getTerrainFlags.
export type TerrainWatcher = (location: number) => void;

export type WatchTerrainFn = (
  locations: Iterable<number>,
  watcher: TerrainWatcher,
) => void;

export type GetTerrainFlagsFn = (location: number) => number;

export type ModelFacetForView = {
  watchTerrain: WatchTerrainFn;
  unwatchTerrain: WatchTerrainFn;
  getTerrainFlags: GetTerrainFlagsFn;
};

export type ModelTestFacet = {
  put: (entity: number, slot: number, itemType: number) => void;
  setHealth: (entity: number, health: number) => void;
  setStamina: (entity: number, stamina: number) => void;
};

export type MacroViewModelFacetForModel = {
  put: (entity: number, location: number, tileType: number) => void;
  move: (
    entity: number,
    destination: number,
    directionQuarturns: number,
    turnQuarturns: number,
  ) => void;
  remove: (entity: number) => void;
  jump: (
    entity: number,
    destination: number,
    directionOcturns: number,
    tileType: number,
  ) => void;
  replace: (entity: number, glyph: number) => void;
  movingReplace: (
    entity: number,
    type: number,
    destination: number,
    directionQuarturns: number,
    turnQuarturns: number,
  ) => void;
  take: (entity: number, direction: number) => void;
  give: (
    entity: number,
    origin: number,
    destination: number,
    type: number,
    directionOcturns: number,
  ) => void;
  fell: (entity: number) => void;
  enter: (entity: number) => void;
  exit: (entity: number) => void;
  bounce: (entity: number, directionQuarturns: number) => void;
};

export type MacroViewModelFacetForAdapter = MacroViewModelFacetForModel & {
  down: (entity: number) => () => void;
};

export type MacroViewModelFacetForController = MacroViewModelFacetForModel &
  Clock;

export type ViewModelFacetForMacroViewModel = {
  put: (entity: number, location: number, type: number) => void;
  move: (entity: number, destination: number) => void;
  remove: (entity: number) => void;
  transition: (entity: number, transition: Transition) => void;
  watched: (entity: number) => boolean;
  down: (command: number) => void;
  up: (command: number) => void;
  tock: () => void;
  animate: AnimateFn;
};

export type PlaceFn = (
  entity: number,
  coord: Coord,
  pressure: number,
  progress?: Progress,
  transition?: Transition,
) => void;

// Watcher receives notifications when a tile enters, exits, or moves within a
// view.
export type Watcher = {
  enter: (entity: number, type: number) => void;
  exit: (entity: number) => void;
  place: PlaceFn;
};

export type WatchEntitiesFn = (
  tiles: Map<number, Coord>, // from tile number to coordinate
  watcher: Watcher,
) => void;

export type ViewModelFacetForView = {
  watchEntities: WatchEntitiesFn;
  unwatchEntities: WatchEntitiesFn;
};

export type Recipe = {
  agent: number; // an item type (consumed)
  reagent: number; // an item type (consumed)
  product: number; // an item type (produced)
  byproduct: number; // an item type (produced)
};

export type ModelFollower = {
  move: (
    entity: number,
    cursorChange: CursorChange,
    destination: number,
  ) => void;
  jump: (entity: number, destination: number) => void;
  craft: (entity: number, recipe: Recipe) => void;
  inventory: (entity: number, slot: number, itemType: number) => void;
  dialog: (entity: number, dialog: string) => void;
  health: (entity: number, health: number) => void;
  stamina: (entity: number, stamina: number) => void;
};

export type ModelKit = {
  entityType: (entity: number) => number;
  entityEffect: (entity: number) => number;
  take: (entity: number, direction: number, location: number) => void;
  fell: (entity: number, location: number) => void;
  inventory: (entity: number, slot: number) => number;
  put: (entity: number, slot: number, itemType: number) => void;
  has: (entity: number, itemType: number) => boolean;
  holds: (entity: number, itemType: number) => boolean;
  cold: (entity: number) => boolean;
  hot: (entity: number) => boolean;
  sick: (entity: number) => boolean;
  immersed: (entity: number) => boolean;
  afloat: (entity: number) => boolean;
  entityHealth: (entity: number) => number;
  entityStamina: (entity: number) => number;
  advance: AdvanceFn;
};

export type ActionTypeParameters = {
  agentType: number; // an agent type
  patientType: number; // an agent type
  leftType: number; // an item type
  rightType: number; // an item type
  effectType: number;
};

export type ActionParameters = {
  agent: number;
  patient: number;
  direction: number;
  destination: number;
};

export type ActionHandler = (kit: ModelKit, params: ActionParameters) => void;

export type AgentDescription = {
  name: string;
  tile?: string;
  wanders?: string;
  dialog?: Array<string>;
  health?: number;
  stamina?: number;
  modes?: Array<{
    tile: string;
    holds?: string;
    has?: string;
    hot?: boolean;
    cold?: boolean;
    sick?: boolean;
    health?: number;
    stamina?: number;
    immersed?: boolean;
  }>;
  slots?: Array<{
    tile: string;
    held?: boolean;
    pack?: boolean;
  }>;
};

export type ConditionDescription =
  | { has: true; item: number }
  | { holds: true; item: number }
  | { hot: true }
  | { cold: true }
  | { sick: true }
  | { immersed: true }
  | { health: number }
  | { stamina: number };

export type ItemDescription = {
  name: string;
  tile?: string;
  comestible?: boolean;
  health?: number;
  stamina?: number;
  heat?: number;
  boat?: boolean;
  swimGear?: boolean;
  tip?: string;
  slot?: string;
};

export type TileDescription = {
  name: string;
  text: string;
  turn?: number;
};

export type RecipeDescription = {
  agent: string;
  reagent: string;
  product: string;
  byproduct?: string;
  price?: number;
  dialog?: string;
};

export type ActionDescription = {
  agent?: string;
  patient: string;
  left?: string;
  right?: string;
  effect?: string;
  verb: string;
  items?: Array<string>;
  dialog?: string;
  jump?: string;
};

export type EffectDescription = {
  name: string;
  tile?: string;
};

export type MechanicsDescription = {
  recipes?: Array<RecipeDescription>;
  actions?: Array<ActionDescription>;
  tileTypes?: Array<TileDescription>;
  agentTypes?: Array<AgentDescription>;
  itemTypes?: Array<ItemDescription>;
  effectTypes?: Array<EffectDescription>;
};

// DriverHolderFn Indicates that a key or gesture has been pressed down or up.
// The holder vocabulary is specific to the input modality, but in a web page,
// holders are either the names of keys in keyup and keydown events, or the
// holder may be specifically 'Mouse' or 'Touch'.
// Some commands are implied by the holder in the context of the controller's
// mode, but gestures are bound more specifically to command numbers.
export type DriverHolderFn = (holder: string, command?: number) => boolean;

// Cancel ndicates that the user has navigated away and that all held commands
// are implicitly lifted, bearing in mind they may be actually lifted when the
// user returns.
export type Driver = {
  down: DriverHolderFn;
  up: DriverHolderFn;
  cancel: () => void;
};
