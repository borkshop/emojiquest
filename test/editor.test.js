import test from 'ava';
import { makeEditorModes } from '../editor.js';
import { nullSnapshot } from '../edit.js';
import { standardMeta } from './editor-constants.js';

/**
 * @param {import('ava').ExecutionContext} t
 * @param {Array<string>} dialog
 */
const makeChatFakes = (t, dialog) => {
  return {
    /** @param {unknown} question */
    async choose(question) {
      t.log(question);
      return dialog.shift();
    },
    /** @param {unknown} question */
    async input(question) {
      t.log(question);
      return dialog.shift();
    },
  };
};

/**
 * @template T
 * @param {AsyncIterableIterator<T>} iterable
 */
const asyncSink = async iterable => {
  const iterator = iterable[Symbol.asyncIterator]();
  for (;;) {
    const result = await iterator.next();
    if (result.done) {
      return result.value;
    }
  }
};

test('new world', async t => {
  const { designNewWorld } = makeEditorModes(
    makeChatFakes(t, [
      'rect', // topology
      '1', // width
      '2', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color
    ]),
  );

  const oldMeta = standardMeta;
  const newMeta = await asyncSink(designNewWorld(oldMeta));
  t.is(newMeta.levels.length, 1);
  t.is(newMeta.levels[0].topology, 'rect');
  t.deepEqual(newMeta.levels[0].size, { x: 1, y: 2 });
});

test('new world with three levels', async t => {
  const { designNewWorld, planLevelAddition } = makeEditorModes(
    makeChatFakes(t, [
      // level 1
      'rect', // topology
      '1', // width
      '2', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color

      // level 2
      'rect', // topology
      '2', // width
      '3', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color
      '1', // insertion index (after level 1)
    ]),
  );

  let meta = standardMeta,
    snapshot = nullSnapshot,
    index = 0;

  meta = await asyncSink(designNewWorld(meta));
  ({ meta, snapshot, index } = await asyncSink(
    planLevelAddition(meta, snapshot),
  ));

  t.is(meta.levels.length, 2);
  t.is(snapshot.entities.length, 8);
  t.is(index, 1);
});

test('delete the middle of three levels while standing on it', async t => {
  const { designNewWorld, planLevelAddition, planLevelRemoval } =
    makeEditorModes(
      makeChatFakes(t, [
        // level 1
        'rect', // topology
        '3', // width
        '3', // height
        'brown', // earth color
        'brown', // base color
        'blue', // water color
        'red', // lava color

        // level 2
        'rect', // topology
        '3', // width
        '3', // height
        'brown', // earth color
        'brown', // base color
        'blue', // water color
        'red', // lava color
        '1', // insertion index (after level 1)

        // level 3
        'rect', // topology
        '3', // width
        '3', // height
        'brown', // earth color
        'brown', // base color
        'blue', // water color
        'red', // lava color
        '2', // insertion index (after level 2)
        '1', // teleport to new level since current is removed
      ]),
    );

  let meta = standardMeta,
    snapshot = nullSnapshot,
    index = 0,
    location = 0;

  meta = await asyncSink(designNewWorld(meta));

  ({ meta, snapshot, index } = await asyncSink(
    planLevelAddition(meta, snapshot),
  ));
  t.is(index, 1);

  ({ meta, snapshot, index } = await asyncSink(
    planLevelAddition(meta, snapshot),
  ));
  t.is(index, 2);
  t.is(meta.levels.length, 3);
  t.is(snapshot.entities.length, 3 * 3 * 3);

  ({ meta, snapshot, location } = await asyncSink(
    planLevelRemoval(meta, snapshot, 1, 13),
  ));

  t.is(location, 4);
});

test('delete the last level and create a new rect', async t => {
  const { designNewWorld, planLevelRemoval } = makeEditorModes(
    makeChatFakes(t, [
      // level 1
      'rect', // topology
      '3', // width
      '3', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color

      // remove (and recreate)
      'rect',
      '5', // width
      '5', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color
    ]),
  );

  let meta = standardMeta,
    snapshot = nullSnapshot,
    location = 0;

  meta = await asyncSink(designNewWorld(meta));

  ({ meta, snapshot, location } = await asyncSink(
    planLevelRemoval(meta, snapshot, 0, 0),
  ));

  t.is(location, 12);
});

test('delete the last level and create a new daia', async t => {
  const { designNewWorld, planLevelRemoval } = makeEditorModes(
    makeChatFakes(t, [
      // level 1
      'rect', // topology
      '3', // width
      '3', // height
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color

      // remove (and recreate)
      'daia',
      '3', // tiles per facet
      '1', // facets per face
      'one', // one color palette
      'brown', // earth color
      'brown', // base color
      'blue', // water color
      'red', // lava color
      '2', // teleport to face
    ]),
  );

  let meta = standardMeta,
    snapshot = nullSnapshot,
    location = 0;

  meta = await asyncSink(designNewWorld(meta));

  ({ meta, snapshot, location } = await asyncSink(
    planLevelRemoval(meta, snapshot, 0, 0),
  ));

  t.is(location, 13);
});
