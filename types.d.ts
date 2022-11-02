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

export type MacroViewModel = {
  put: (entity: number, location: number, tileType: number) => void;
  move: (
    entity: number,
    destination: number,
    directionQuarturns: number,
    turnQuarturns: number,
  ) => void;
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
  fell: (entity: number) => void;
  enter: (entity: number) => void;
  exit: (entity: number) => void;
  bounce: (entity: number, directionQuarturns: number) => void;
};

export type Recipe = {
  agent: number; // an item type (consumed)
  reagent: number; // an item type (consumed)
  product: number; // an item type (produced)
  byproduct: number; // an item type (produced)
};

export type Follower = {
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

export type Kit = {
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
  entityHealth: (entity: number) => number;
  entityStamina: (entity: number) => number;
  advance: AdvanceFn;
};

export type BumpKeyParameters = {
  agentType: number; // an agent type
  patientType: number; // an agent type
  leftType: number; // an item type
  rightType: number; // an item type
  effectType: number;
};

export type HandlerParameters = {
  agent: number;
  patient: number;
  direction: number;
  destination: number;
};

export type Handler = (kit: Kit, params: HandlerParameters) => void;

// Informs the view that the animation turn has begun.
export type TickFn = () => void;
// Informs the view that the animation turn has ended.
export type TockFn = () => void;

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
