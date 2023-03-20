// EmojiQuest uses schemas to ease interaction with the game save file format.
//
// The game save schema expresses both a high-level in-memory representation
// and the corresponding low-level JSON structure.
// This allows us to use maps instead of objects and typed arrays instead of
// arrays in some cases.
// From the schema, we can structurally validate arbitrary JSON with fine
// granularity error messages, though that leaves further work on the table for
// verifying semantic consistency.
// We also generate the TypeScript definition for the in-memory representation.
// The premise is that, if the schema validator approves an any-typed JSON
// blob, it should be safe to narrow it to the corresponding TypeScript type
// and worry no more.
//
// In this draft of the schema system, the source of truth for a schema is a
// generic function that accepts a behavior implementation.
// One such implementation converts the schema to an object graph
// (schema-describer.js) and flattens optional versus implicitly required
// fields of structs and tagged unions (choices).
// Another generates TypeScript, etc.

export type SchemaTo<T> = {
  // A number in JSON, a number in memory.
  number: () => T;
  // A boolean in JSON, a boolean in memory.
  boolean: () => T;
  // A string in JSON, a string in memory.
  string: () => T;
  // An array of numbers in JSON, a Uint8Array in memory.
  uint8array: () => T;
  // An array of numbers in JSON, a Uint16Array in memory.
  uint16array: () => T;
  // A value that may be null or undefined in memory, which should simply be
  // omitted if absent in JSON.
  optional: (t: T) => T;
  // An array of arbitrary values in JSON and in memory.
  list: (t: T) => T;
  // A map with string keys in memory, an Object in JSON.
  dict: (t: T) => T;
  // A map with numeric keys in memory, an Object in JSON.
  index: (t: T) => T;
  // A map between arbitrary types in memory and an array of entry arrays in JSON.
  map: (k: T, v: T) => T;
  // An object with named keys in both memory and in JSON.
  struct: (shape: Record<string, T>) => T;
  // A union of object types in memory and in TypeScript, discriminated by a
  // tag property, represented as a flat Object in JSON.
  choice: (tagName: string, options: Record<string, Record<string, T>>) => T;
};

export type Schema = <T>(schema: SchemaTo<T>) => T;
