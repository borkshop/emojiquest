import test from 'ava';
import { assumeDefined } from '../lib/assert.js';
import { addLevel, removeLevel, nullSnapshot } from '../edit.js';
import { standardMeta, standardLevelColors } from './editor-constants.js';

const makeSingleLevel = ({ width = 1, height = 1 } = {}) => {
  /** @type {import('../schema-types.js').LevelDescription} */
  return {
    topology: /** @type {'rect'} */ ('rect'),
    size: { x: width, y: height },
    colors: standardLevelColors,
  };
};

const makeSingleLevelSnapshot = ({ width = 1, height = 1 } = {}) => {
  const level0 = makeSingleLevel({ width, height });
  return addLevel(standardMeta, nullSnapshot, level0, 0);
};

test('add an initial level', t => {
  const { meta, snapshot } = makeSingleLevelSnapshot();
  t.is(meta.levels.length, 1);
  t.is(assumeDefined(snapshot).entities.length, 1);
});

test('add a level before the initial level', t => {
  let { meta, snapshot } = makeSingleLevelSnapshot();
  snapshot.entities[0] = 1; // marker
  snapshot.types.set(1, 1);
  const level1 = makeSingleLevel({ width: 2 });
  ({ meta, snapshot } = addLevel(meta, snapshot, level1, 0));
  t.is(snapshot.entities.length, 3);
  t.is(snapshot.entities[2], 1);
});

test('add a level after the initial level', t => {
  let { meta, snapshot } = makeSingleLevelSnapshot();
  snapshot.entities[0] = 1; // marker
  snapshot.types.set(1, 1);
  const level1 = makeSingleLevel({ width: 2 });
  ({ meta, snapshot } = addLevel(meta, snapshot, level1, 1));
  t.is(snapshot.entities.length, 3);
  t.is(snapshot.entities[0], 1);
});

const makeThreeLevels = () => {
  let meta = standardMeta;
  let snapshot = nullSnapshot;
  const level0 = makeSingleLevel();
  const level1 = makeSingleLevel({ height: 2 });
  const level2 = makeSingleLevel({ width: 2 });
  ({ meta, snapshot } = addLevel(meta, snapshot, level0, 0));
  ({ meta, snapshot } = addLevel(meta, snapshot, level1, 1));
  ({ meta, snapshot } = addLevel(meta, snapshot, level2, 2));
  return { meta, snapshot };
};

test('add three levels', t => {
  const { meta, snapshot } = makeThreeLevels();
  t.is(meta.levels.length, 3);
  t.is(snapshot.entities.length, 5);
});

test('remove a middle level', t => {
  let { meta, snapshot } = makeThreeLevels();

  // markers
  for (let i = 0; i < snapshot.entities.length; i += 1) {
    snapshot.entities[i] = i + 1;
    snapshot.types.set(i + 1, 1);
  }

  ({ meta, snapshot } = removeLevel(meta, snapshot, 1));
  t.is(meta.levels.length, 2);
  t.is(snapshot.entities.length, 3);

  t.is(snapshot.entities[0], 1);
  // removed level accounted for entities 1 and 2
  t.is(snapshot.entities[1], 4);
  t.is(snapshot.entities[2], 5);
});

test('remove a middle level while standing before it', t => {
  let { meta, snapshot } = makeThreeLevels();

  /** @type {number | undefined} */
  let location = 0;
  ({ meta, snapshot, location } = removeLevel(meta, snapshot, 1, location));
  t.is(location, 0);
});

test('remove a middle level while standing on it', t => {
  let { meta, snapshot } = makeThreeLevels();

  /** @type {number | undefined} */
  let location = 1;
  ({ meta, snapshot, location } = removeLevel(meta, snapshot, 1, location));
  t.is(location, undefined);
});

test('remove a middle level while standing after it', t => {
  let { meta, snapshot } = makeThreeLevels();

  /** @type {number | undefined} */
  let location = 4;
  ({ meta, snapshot, location } = removeLevel(meta, snapshot, 1, location));
  t.is(location, 2);
});
