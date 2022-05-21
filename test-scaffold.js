import { makeDaia } from './daia.js';
import { makeModel } from './model.js';
import { makeMechanics } from './mechanics.js';
import { makeController } from './controls.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeBoxTileMap } from './tile-map-box.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from './data.js';

/**
 * @param {import('ava').ExecutionContext} t
 * @param {Object} args
 * @param {import('./geometry2d.js').Point} args.size
 * @param {Array<import('./mechanics.js').TileType>} args.tileTypes
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

  /** @type {import('./view-model.js').Watcher} */
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
        let open = '';
        let close = '';
        for (const entity of entities) {
          const type = types.get(entity);
          t.assert(
            type !== undefined,
            `no type for entity ${entity} at (${x}, ${y})`,
          );
          if (type === -1) {
            open = '(';
            close = ')';
          } else {
            const tile = tileTypes[type];
            t.assert(tile !== undefined);
            const name = tile.name;
            glyph = glyphsByTileName[name] || name.slice(0, 1);
          }
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
    const actual = draw().trim();
    t.is(actual, expected);
  };

  return { watcher, draw, expect };
};

/**
 * @param {import('ava').ExecutionContext} t
 */
export const makeScaffold = (t, { size = 3 } = {}) => {
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
  };

  /** @type {number | undefined} */
  let player;

  /** @type {Record<string, string>} */
  const agentTypesByGlyph = {
    '@': 'player',
    A: 'appleTree',
  };

  const mechanics = makeMechanics({
    recipes,
    actions,
    tileTypes,
    validAgentTypes,
    validItemTypes,
    validEffectTypes,
  });

  const world = makeDaia({
    faceSize: size,
    tileSizePx: NaN,
  });

  const {
    watcher: worldWatcher,
    expect: expectScene,
    draw: drawScene,
  } = makeTestWatcher(t, {
    size: { x: size, y: size },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel);

  worldViewModel.watchEntities(
    makeBoxTileMap({
      x: size,
      y: size,
    }),
    worldWatcher,
  );

  const { watcher: nineKeyWatcher, expect: expectControls } = makeTestWatcher(
    t,
    {
      size: { x: 3, y: 3 },
      tileTypes: mechanics.tileTypes,
      glyphsByTileName,
    },
  );

  const { watcher: oneKeyWatcher, expect: expectButton } = makeTestWatcher(t, {
    size: { x: 1, y: 1 },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const worldModel = makeModel({
    size: world.worldArea,
    advance: world.advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
  });

  const cameraController = {
    move() {},
    jump() {},
    animate() {},
    tick() {},
    tock() {},
  };

  const { toponym, advance } = world;

  /**
   * @param {number} _destination
   * @param {import('./daia.js').CursorChange} _change
   */
  const followCursor = (_destination, _change) => {};

  const menuController = {
    goNorth() {},
    goSouth() {},
    getState() {
      return 'play';
    },
    show() {},
    hide() {},
    animate() {},
    tock() {},
  };

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
    tock() {},
  };

  const staminaController = {
    set() {},
    animate() {},
    tock() {},
  };

  const controller = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    worldModel,
    worldMacroViewModel,
    cameraController,
    toponym,
    advance,
    followCursor,
    mechanics,
    menuController,
    dialogController,
    healthController,
    staminaController,
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
          const location = world.tileNumber({ x, y, f });
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

  const play = () => {
    controller.play(player);
    controller.tock();
  };

  /**
   * @param {unknown} data
   */
  const restore = data => {
    const result = worldModel.restore(data);
    if (typeof result === 'number') {
      player = result;
    } else {
      t.fail(result.join(', '));
    }
  };

  /**
   * @param {number} digit
   * @param {boolean} [repeat]
   */
  const command = (digit, repeat = false) => {
    // t.log('---');
    // t.log('command', digit, repeat);
    controller.command(digit, repeat);
    controller.tock();
  };

  /** @param {string} modeName */
  const expectMode = modeName => {
    t.is(controller.modeName(), modeName);
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

  return {
    scene,
    play,
    restore,
    command,
    controller,
    worldModel,
    expectMode,
    expectControls,
    expectScene,
    drawScene,
    expectButton,
    world,
    mechanics,
    expectInventory,
    get health() {
      return health;
    },
  };
};
