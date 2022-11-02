
// A TileCoordinate fully qualifies a coordinate on a possibly multi-faceted
// level.
export type TileCoordinate = {
  t: number, // tile number
  f: number, // face of tile number
  n: number, // row major index of tile on face
  x: number, // horizontal position on face
  y: number, // vertical position on face
};

// A TileCoordinateFn translates a tile number to a fully qualified coordinate
// on a level of a possibly multi-faceted level.
export type TileCoordinateFn = (
  t: number, // tile number
) => TileCoordinate;

// A TileQuery describes a coordinate on a possibly multi-faceted level.
export type TileQuery = {
  f: number, // face number of tile
  x: number, // horizontal position on face
  y: number, // vertical position on face
};

// A TileNumberFn translates a face number and coordinate for a particular
// location to its corresponding position number in the model.
export type TileNumberFn = (
  query: TileQuery,
) => number;

// A Cursor describes a location and orientation in the world.
export type Cursor = {
  position: number, // a location number (depending on model topology)
  direction: number, // a direction number (depending again on model topology)
};

// A CursorChange describes a destination and how an entity will get there.
export type CursorChange = Cursor & {
  turn: number, // a change to the cursor direction (in units depending on model topology)
  transit: boolean, // whether the cursor change is discontinuous, jumping to another level or face.
};

// An AdvanceFn indicates what (if any) tile is adjacent to an origin tile and
// how motion to that tile will reorient an entity that passes in that
// direction.
export type AdvanceFn = (
  cursor: Cursor,
) => CursorChange | undefined;

// A ToponymFn produces a description of a location in the world, suitable for
// display to an editor to get a sense of where they are in the grand scheme of
// things.
export type ToponymFn = (
  t: number // tile number
) => string;
