// @ts-check

import fs from 'fs/promises';
import { makeDaia } from './daia.js';
import { makeModel, terrainWater, terrainHot, terrainCold } from './model.js';
import { makeMechanics } from './mechanics.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from './data.js';

const macroViewModel = {
  put() {},
  move() {},
  bounce() {},
  take() {},
  fell() {},
  enter() {},
  exit() {},
  tock() {},
};

const { faceSize, tileNumber, advance, worldArea } = makeDaia({
  tileSizePx: NaN,
  faceSize: 81,
});

const mechanics = makeMechanics({
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
});

const model = makeModel({
  size: worldArea,
  advance,
  macroViewModel,
  mechanics,
});

let snapshotText = await fs.readFile('daia.json', 'utf8');
let snapshot = JSON.parse(snapshotText);
const agent = model.restore(snapshot);
if (typeof agent !== 'number') throw new Error('restore must succeed');

/**
 * @param {number} f - face number
 * @param {number} terrainFlags
 */
const paintFaceFlags = (f, terrainFlags) => {
  for (let x = 0; x < faceSize; x += 1) {
    for (let y = 0; y < faceSize; y += 1) {
      const location = tileNumber({ x, y, f });
      model.setTerrainFlags(location, terrainFlags);
    }
  }
};

const paint = (f, { x: x1, y: y1 }, { x: x2, y: y2 }, entityType) => {
  for (let x = x1; x < x2; x += 1) {
    for (let y = y1; y < y2; y += 1) {
      const location = tileNumber({ x, y, f });
      model.set(location, entityType);
    }
  }
};

// paintFaceFlags(1, terrainHot);
// paintFaceFlags(2, terrainCold | terrainWater);
// paintFaceFlags(3, terrainCold);
// paintFaceFlags(4, terrainWater);

// paint(
//   5,
//   { x: 0, y: 0 },
//   { x: faceSize, y: faceSize / 3 },
//   mechanics.agentTypesByName.pineTree,
// );
// paint(
//   5,
//   { x: 0, y: 0 },
//   { x: faceSize / 3, y: faceSize },
//   mechanics.agentTypesByName.pineTree,
// );
// paint(
//   5,
//   { x: 0, y: (faceSize * 2) / 3 },
//   { x: faceSize, y: faceSize },
//   mechanics.agentTypesByName.pineTree,
// );

snapshot = model.capture(agent);
snapshotText = JSON.stringify(snapshot);
await fs.writeFile('daia.json', snapshotText, 'utf8');
