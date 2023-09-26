import test from 'ava';

import { makeElementIndex } from '../gltiles.js';

for (const { name, cap, bytes, els } of [

  {
    name: 'basic',
    cap: 512,
    bytes: 2,
    els: [
      3,
      1,
      5,
      4,
      4,
      100,
      50,
      75,
    ],
  },

  {
    name: 'recorded',
    cap: 30,
    bytes: 1,
    els: [
      0,
      3,
      5,
      6,
      7,
      8,
      9,
      10,
      12,
      2,
      9,
      11,
      12,
      14,
      15,
      16,
    ],
  },

]) test(`index: ${name}`, t => {
  t.timeout(100, 'should be quick');

  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('need a test gl context');

  const index = makeElementIndex(gl, cap);
  // XXX t.is(index.elementByteSize, bytes);

  /** @type {Set<number>} */
  const expected = new Set();
  for (const el of els) {
    if (!t.is(index.length, expected.size)) break;

    expected.add(el);
    index.add(el);

    if (!t.is(index.length, expected.size)) break;
    if (!t.deepEqual([...index], [...expected].sort((a, b) => a - b))) break;

    t.log([...index]);

  }

  // [ 0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16 ]
  // [ 0, 2,                9,     11, 12, 14, 15, 16 ]

});
