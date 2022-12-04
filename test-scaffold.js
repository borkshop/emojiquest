import url from 'url';
import fs from 'fs/promises';

import { assertDefined } from './lib/assert.js';
import { makeTopology } from './topology/daia/topology.js';
import { makeToponym } from './topology/daia/toponym.js';
import {
  makeModel,
  terrainWater,
  terrainLava,
  terrainCold,
  terrainHot,
} from './model.js';
import { makeMechanics } from './mechanics.js';
import { makeController, builtinTileNames } from './controller.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeBoxTileMap } from './tile-map-box.js';
import * as emojiquestMechanics from './emojiquest/mechanics.js';
import { validate } from './file.js';

/**
 * @param {import('ava').ExecutionContext} t
 * @param {Object} args
 * @param {import('./lib/geometry2d.js').Point} args.size
 * @param {Array<import('./mechanics.js').TileDescription>} args.tileTypes
 * @param {Record<string, string>} args.glyphsByTileName
 */
const makeTestWatcher = (t, { size, tileTypes, glyphsByTileName }) => {
  const locations = new Map();
  const types = new Map();
  /** @type {Map<number, Map<number, Set<number>>>} */
  const table = new Map();

  /** @param {{x: number, y: number}} coord */
  const provideCell = ({ x, y }) => {
    let column = table.get(y);
    if (column === undefined) {
      /** @type {Map<number, Set<number>>} */
      column = new Map();
      table.set(y, column);
    }
    let cell = column.get(x);
    if (cell === undefined) {
      /** @type {Set<number>} */
      cell = new Set();
      column.set(x, cell);
    }
    return cell;
  };

  /** @type {import('./types.js').Watcher} */
  const watcher = {
    enter(entity, type) {
      // t.log('9x9 enter', { entity, type });
      types.set(entity, type);
    },
    exit(entity) {
      const location = locations.get(entity);
      const type = types.get(entity);
      // t.log('9x9 exit', { entity, location });
      t.assert(location !== undefined);
      t.assert(type !== undefined);
      provideCell(location).delete(entity);
      locations.delete(entity);
      types.delete(entity);
    },
    place(entity, location, _pressure, _progress, _transition) {
      const priorLocation = locations.get(entity);
      if (priorLocation !== undefined) {
        provideCell(priorLocation).delete(entity);
      }
      locations.set(entity, location);
      provideCell(location).add(entity);
    },
  };

  const draw = () => {
    let drawing = '';
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        const entities = provideCell({ x, y });
        let glyph = '.';
        let open = ' ';
        let close = ' ';

        const entityTypes = [...entities].map(entity => types.get(entity));
        const nonReticleEntityTypes = entityTypes.filter(
          entityType => entityType !== -1,
        );
        const entityGlyphs = nonReticleEntityTypes.map(entityType => {
          let name = '';
          if (entityType >= 0) {
            const tile = tileTypes[entityType];
            t.assert(tile !== undefined);
            ({ name } = tile);
          } else if (entityType < -1) {
            name = builtinTileNames[-entityType - 2];
            t.assert(name !== undefined, `${entityType}`);
          }
          return glyphsByTileName[name] || name.slice(0, 1);
        });
        t.assert(
          nonReticleEntityTypes.length <= 1,
          `Multiple non-reticle entity types at (${x}, ${y}): ${entityGlyphs
            .map(glyph => JSON.stringify(glyph))
            .join(', ')}`,
        );

        if (entityTypes.length > nonReticleEntityTypes.length) {
          open = '(';
          close = ')';
        }
        for (const entityGlyph of entityGlyphs) {
          glyph = entityGlyph;
        }
        drawing += open + glyph + close;
      }
      drawing += '\n';
    }
    return drawing;
  };

  /**
   * @param {string} looselyExpected
   */
  const expect = looselyExpected => {
    const expected = looselyExpected
      .replace(/ /g, '')
      .replace(/<-[^\n]*/g, '') // comments
      .trim();
    const actual = draw().replace(/ /g, '').trim();
    t.is(actual, expected);
  };

  return { watcher, draw, expect };
};

/**
 * @param {import('ava').ExecutionContext} t
 * @param {object} args
 * @param {number} [args.tilesPerFacet]
 * @param {number} [args.facetsPerFace]
 * @param {{[glyph: string]: string}} [args.legend]
 * @param {unknown} [args.worldData]
 */
export const makeScaffold = (
  t,
  {
    tilesPerFacet = 3,
    facetsPerFace = 1,
    legend = {},
    worldData = undefined,
  } = {},
) => {
  /** @type {Record<string, string>} */
  const glyphsByTileName = {
    north: '^',
    south: 'v',
    watch: 'z',
    west: '<',
    east: '>',
    left: '[',
    right: ']',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    happy: '@',
    appleTree: 'A',
    knittingNeedles: 'n',
    ...Object.fromEntries(
      Object.entries(legend).map(([glyph, name]) => [name, glyph]),
    ),
  };

  /** @type {number | undefined} */
  let player;

  /** @type {Record<string, string>} */
  const agentTypesByGlyph = {
    '@': 'player',
    A: 'appleTree',
    P: 'pearTree',
    M: 'mountain',
    B: 'bank',
    F: 'forge',
    ...legend,
  };

  const mechanics = makeMechanics(emojiquestMechanics);

  const size = tilesPerFacet * facetsPerFace;

  const topology = makeTopology({ faceSize: size });

  const toponym = makeToponym(topology);

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel, {
    name: 'world',
  });

  const faces = new Array(6).fill(undefined).map((_, face) => {
    const {
      watcher: worldWatcher,
      expect: expectScene,
      draw: drawScene,
    } = makeTestWatcher(t, {
      size: { x: size, y: size },
      tileTypes: mechanics.tileTypes,
      glyphsByTileName,
    });

    worldViewModel.watchEntities(
      makeBoxTileMap(
        {
          x: size,
          y: size,
        },
        {
          x: 0,
          y: 0,
        },
        topology.faceArea * face,
      ),
      worldWatcher,
    );

    return { expectScene, drawScene };
  });

  const expectScenes = faces.map(({ expectScene }) => expectScene);
  const drawScenes = faces.map(({ drawScene }) => drawScene);

  /**
   * @param {string} looselyExpected
   * @param {number} [face]
   */
  const expectScene = (looselyExpected, face = 0) =>
    expectScenes[face](looselyExpected);

  /**
   * @param {number} [face]
   */
  const drawScene = (face = 0) => drawScenes[face]();

  const {
    watcher: nineKeyWatcher,
    expect: expectControls,
    draw: drawControls,
  } = makeTestWatcher(t, {
    size: { x: 3, y: 3 },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const {
    watcher: oneKeyWatcher,
    expect: expectButton,
    draw: drawButton,
  } = makeTestWatcher(t, {
    size: { x: 1, y: 1 },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  /** @type {import('./model.js').Snapshot | undefined} */
  let snapshot = undefined;
  if (worldData !== undefined) {
    const result = validate(worldData);
    if ('errors' in result) {
      t.fail(result.errors.join(', '));
    }
    if ('snapshot' in result) {
      snapshot = result.snapshot;
      player = snapshot.player;
    }
  }

  const worldModel = makeModel({
    size: topology.worldArea,
    advance: topology.advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
    snapshot,
  });

  const cameraController = {
    move() {},
    jump() {},
    animate() {},
    tick() {},
    tock() {},
  };

  const { advance } = topology;

  /**
   * @param {number} _destination
   * @param {import('./types.js').CursorChange} _change
   */
  const followCursor = (_destination, _change) => {};

  const dialogController = {
    /** @param {string} _message */
    log(_message) {
      // t.log(_message);
    },
    /** @param {string} _message */
    logHTML(_message) {
      // t.log(_message);
    },
    close() {},
    animate() {},
    tock() {},
  };

  let health = 0;
  const healthController = {
    /** @param {number} newHealth */
    set(newHealth) {
      health = newHealth;
    },
    animate() {},
    tick() {},
    tock() {},
    hide() {},
    show() {},
  };

  let stamina = 0;
  const staminaController = {
    /** @param {number} newStamina */
    set(newStamina) {
      stamina = newStamina;
    },
    animate() {},
    tick() {},
    tock() {},
    hide() {},
    show() {},
  };

  const capture = () => ({
    levels: [
      {
        topology: 'daia',
        facetsPerFace,
        tilesPerFacet,
      },
    ],
    ...worldModel.capture(player),
  });

  const world = {
    name: 'Test World',
    mechanics,
    worldModel,
    worldMacroViewModel,
    cameraController,
    toponym,
    advance,
    capture,
    levels: [], // TODO
  };

  const supplementaryAnimation = {
    tick() {},
    tock() {},
    animate() {},
  };

  const choose = async () => undefined;

  const controller = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    dialogController,
    healthController,
    staminaController,
    followCursor,
    // @ts-expect-error This stub is not used in tests.
    async loadWorld() {},
    async saveWorld() {},
    choose,
    supplementaryAnimation,
  });

  /**
   * @param {string} spec
   * @param {number} [f]
   */
  const scene = (spec, f = 0) => {
    const table = spec
      .replace(/ +/g, '')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(''));
    let y = 0;
    for (const line of table) {
      let x = 0;
      for (const glyph of line) {
        if (glyph !== '.') {
          const location = topology.tileNumber({ x, y, f });
          // t.log({x, y, f, location});
          const agentTypeName = agentTypesByGlyph[glyph];
          t.assert(
            agentTypeName !== undefined,
            `Scene cannot contain glyph ${glyph} with no corresponding agent type`,
          );
          const agentType = mechanics.agentTypesByName[agentTypeName];
          const entity = worldModel.set(location, agentType);
          if (glyph === '@') {
            player = entity;
          }
        }
        x += 1;
      }
      y += 1;
    }
  };

  /**
   * @param {string} spec
   * @param {number} [f]
   */
  const terrain = (spec, f = 0) => {
    const table = spec
      .replace(/ +/g, '')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(''));
    let y = 0;
    for (const line of table) {
      let x = 0;
      for (const glyph of line) {
        const location = topology.tileNumber({ x, y, f });
        if (glyph === 'w') {
          worldModel.toggleTerrainFlags(location, terrainWater);
        } else if (glyph === 'l') {
          worldModel.toggleTerrainFlags(location, terrainLava);
        } else if (glyph === 'h') {
          worldModel.toggleTerrainFlags(location, terrainHot);
        } else if (glyph === 'c') {
          worldModel.toggleTerrainFlags(location, terrainCold);
        } else {
          t.assert(glyph === '.');
        }
        x += 1;
      }
      y += 1;
    }
  };

  const play = () => {
    controller.play(
      world,
      mechanics,
      player,
      /** @type {import('./file.js').WholeWorldDescription} */ ({}),
    );
    controller.tock();
  };

  /**
   * @param {number} digit
   * @param {boolean} [repeat]
   */
  const command = async (digit, repeat = false) => {
    // t.log('---');
    // t.log('command', digit, repeat);
    for await (const _ of controller.handleCommand(digit, repeat)) {
    }
    controller.tock();
  };

  /** @param {string} modeName */
  const expectMode = modeName => {
    t.is(controller.modeName(), modeName);
  };

  /**
   * @param {number} slot
   * @param {string} itemName
   */
  const inventory = (slot, itemName) => {
    if (typeof player !== 'number') {
      t.fail('no player, no inventory');
      return;
    }
    const itemType = mechanics.itemTypesByName[itemName];
    t.assert(itemType !== undefined, `No such item type for name ${itemName}`);
    worldModel.put(player, slot, itemType);
    controller.tock();
  };

  /**
   * @param {number} slot
   * @param {string} expectedItemName
   */
  const expectInventory = (slot, expectedItemName) => {
    if (typeof player !== 'number') {
      t.fail('no player, no inventory');
      return;
    }
    const itemType = worldModel.inventory(player, slot);
    const actualItemName = mechanics.itemTypes[itemType].name;
    t.is(actualItemName, expectedItemName);
  };

  /**
   * @param {string} location
   * @param {string} referrer
   */
  const save = async (location, referrer) => {
    const path = url.fileURLToPath(new URL(location, referrer));
    await fs.writeFile(path, JSON.stringify(capture()));
  };

  return {
    scene,
    terrain,
    play,
    command,
    controller,
    worldModel,
    expectMode,
    expectControls,
    drawControls,
    expectScene,
    drawScene,
    expectButton,
    drawButton,
    world,
    mechanics,
    inventory,
    expectInventory,
    get health() {
      return health;
    },
    /** @param {number} health */
    set health(health) {
      assertDefined(player);
      worldModel.setHealth(player, health);
    },
    get stamina() {
      return stamina;
    },
    /** @param {number} stamina */
    set stamina(stamina) {
      assertDefined(player);
      worldModel.setStamina(player, stamina);
    },
    capture,
    save,
  };
};
