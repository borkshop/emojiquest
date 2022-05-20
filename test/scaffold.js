import { makeDaia } from '../daia.js';
import { makeModel } from '../model.js';
import { makeMechanics } from '../mechanics.js';
import { makeController } from '../controls.js';
import { makeViewModel } from '../view-model.js';
import { makeMacroViewModel } from '../macro-view-model.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from '../data.js';

/**
 * @param {import('ava').ExecutionContext} t
 */
export const makeScaffold = t => {
  let player = -1;

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
  };

  /** @type {Record<string, string>} */
  const agentTypesByGlyph = {
    '@': 'player',
    A: 'appleTree',
  };

  const nineKeyLocations = new Map();
  const nineKeyTypes = new Map();
  const nineKeys = [
    [new Set(), new Set(), new Set(), new Set(), new Set()],
    [new Set(), new Set(), new Set(), new Set(), new Set()],
    [new Set(), new Set(), new Set(), new Set(), new Set()],
    [new Set(), new Set(), new Set(), new Set(), new Set()],
    [new Set(), new Set(), new Set(), new Set(), new Set()],
  ];

  const world = makeDaia({
    faceSize: 3,
    tileSizePx: NaN,
  });

  /** @type {import('../tile-view.js').TileView} */
  const nineKeyTileView = {
    enter(entity, type) {
      // t.log('9x9 enter', { entity, type });
      nineKeyTypes.set(entity, type);
    },
    exit(entity) {
      const location = nineKeyLocations.get(entity);
      const type = nineKeyTypes.get(entity);
      // t.log('9x9 exit', { entity, location });
      t.assert(location !== undefined);
      t.assert(type !== undefined);
      const { x, y } = location;
      nineKeys[y + 1][x + 1].delete(entity);
      nineKeyLocations.delete(entity);
      nineKeyTypes.delete(entity);
    },
  };

  /** @type {import('../tile-view.js').TileView} */
  const oneKeyTileView = {
    enter(_entity) {},
    exit(_entity) {},
  };

  /** @type {import('../view-model.js').PlaceFn} */
  const placeOneKey = (_entity, coord, _pressure, _progress, _transition) => {
    t.deepEqual(coord, { x: 0, y: 0, a: 0 });
  };

  /** @type {import('../view-model.js').PlaceFn} */
  const placeNineKey = (
    entity,
    location,
    _pressure,
    _progress,
    _transition,
  ) => {
    const priorLocation = nineKeyLocations.get(entity);
    if (priorLocation !== undefined) {
      const { x, y } = priorLocation;
      nineKeys[y + 1][x + 1].delete(entity);
    }

    nineKeyLocations.set(entity, location);
    const { x, y } = location;
    nineKeys[y + 1][x + 1].add(entity);
  };

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel);

  const mechanics = makeMechanics({
    recipes,
    actions,
    tileTypes,
    validAgentTypes,
    validItemTypes,
    validEffectTypes,
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
   * @param {import('../daia.js').CursorChange} _change
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

  const drawScene = (f = 0) => {};

  const drawNineKey = () => {
    let drawing = '';
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const entities = nineKeys[y + 1][x + 1];
        let glyph = '.';
        let open = '';
        let close = '';
        for (const entity of entities) {
          const type = nineKeyTypes.get(entity);
          t.assert(
            type !== undefined,
            `no type for entity ${entity} at (${x}, ${y})`,
          );
          if (type === -1) {
            open = '(';
            close = ')';
          } else {
            const tile = mechanics.tileTypes[type];
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
  const expectControls = looselyExpected => {
    const expected = looselyExpected
      .replace(/ /g, '')
      .replace(/<-[^\n]*/g, '') // comments
      .trim();
    const actual = drawNineKey().trim();
    t.is(actual, expected);
  };

  const controller = makeController({
    nineKeyTileView,
    oneKeyTileView,
    placeOneKey,
    placeNineKey,
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

  return {
    scene,
    play,
    command,
    controller,
    worldModel,
    drawNineKey,
    expectMode,
    expectControls,
    world,
    mechanics,
    get health() {
      return health;
    },
  };
};
