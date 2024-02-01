// @ts-check

import test from 'ava';

import {
  makeDataFrame,
  MonotonicIndex,
  makeXYIndex,
} from './dataframe.js';

function getHostLittleEndian() {
  const testNumber = 0x12_34_56_78;
  const testArray = new Uint32Array(1);
  testArray[0] = testNumber;
  const testView = new DataView(testArray.buffer);
  if (testView.getUint32(0, true) == testNumber)
    return true;
  if (testView.getUint32(0, false) == testNumber)
    return false;
  throw new Error('failed to test host endianness');
}

const littleEndian = getHostLittleEndian();

/** @param {number[]} bytes */
function toHostOrder(...bytes) {
  if (littleEndian) bytes.reverse();
  return bytes;
}

test('basic dataframe', t => {
  const df = makeDataFrame(MonotonicIndex, {

    // a scalar aspect
    light: 'uint8',

    // a vecotr aspect
    pos: 'vec2',

    // a matrix aspect
    transform: 'mat4',

    // a struct aspect
    colors: {
      struct: {
        bg: 'rgba',
        fg: 'rgb',
      },
    },

    // a sparse scalar aspect
    energy: { sparse: 'uint32' },

    // a sparse non-standard vector aspect
    could: { sparse: { array: 'bool', shape: 10 } },

    // a sparse matrix aspect
    range: { sparse: 'mat2' },

    // a sparse struct aspect
    stats: {
      sparse: {
        struct: {
          hp: 'uint16',
          con: 'uint8',
          str: 'uint8',
          dex: 'uint8',
          int: 'uint8',
          wis: 'uint8',
          cha: 'uint8',
        }
      }
    },

  });

  // TODO test ref sealed-ness
  // TODO test ref $id readonly

  // initially empty
  t.is(df.length, 0);
  for (let id = 0; id <= 4; id++)
    t.is(df.ref(id), undefined);

  // first 4 element indexes
  df.resize(4);
  t.is(df.length, 4);
  t.is(df.ref(0), undefined);
  for (let id = 1; id <= 4; id++)
    t.not(df.ref(id), undefined);
  t.is(df.ref(9), undefined);

  // first 4 elements of dense aspect
  {
    const dat = df.aspects.colors;
    t.is(dat.length, 4);
    t.is(dat.ref(0), undefined);
    for (let $id = 1; $id <= 4; $id++)
      t.deepEqual(myCopy(dat.ref($id)), {
        $id,
        bg: [0, 0, 0, 0],
        fg: [0, 0, 0],
      });
    t.is(dat.ref(9), undefined);
  }

  // first 4 ids should have basic indices
  for (let id = 1; id <= 4; id++) t.is(df.ref(id)?.$index, id - 1);

  // empty data initially
  for (let $id = 1; $id <= 4; $id++) t.deepEqual(myCopy(df.ref($id)), {
    $id,
    light: 0,
    pos: [0, 0],
    transform: [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ],
    colors: {
      bg: [0, 0, 0, 0],
      fg: [0, 0, 0],
    },
    energy: undefined,
    could: undefined,
    range: undefined,
    stats: undefined,
  });

  t.deepEqual(copiedFrom(df.aspects.energy.all()), []);

  // setup first 4 objects fields
  for (let id = 1; id <= 4; id++) {
    const ref = df.ref(id);
    if (!ref) continue;

    // dense fields
    ref.light = id * 0xdead_beef + 1234; // NOTE uint8, implicity (mod 256)
    ref.pos = [
      Math.floor((id - 1) / 2),
      (id - 1) % 2
    ];
    ref.transform = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, id, 0, // Z scale factor as id * 100%
      0, 0, 0, 1,
    ];
    const gr = id * 0x10;
    ref.colors = {
      bg: [0, 0, 0, 0xff],
      fg: [gr, gr, gr],
    };

    let rng = id * 0xdead_beef + 0x5747;
    const rand = () => rng = (rng * 0xdead_beef + 0x5747) % 0xffff_ffff;

    // some sparse fields
    if (id % 2 == 0) {
      // a character, having energy and stats
      const rollStat = ({ count = 4, keep = 3, max = 6 } = {}) => (new Array(count).fill(0)
        .map(() => rand() % max)
        .sort((a, b) => a - b)
        .slice(0, keep)
        .reduce((a, b) => a + b));
      const con = rollStat();

      ref.energy = id * 7;

      ref.stats = {
        hp: 10 * con,
        con,
        str: rollStat(),
        dex: rollStat(),
        int: rollStat(),
        wis: rollStat(),
        cha: rollStat(),
      };
    } else {
      // non character, initialize data as if we'd be doing some PCG
      ref.could = new Array(10).fill(0).map(() =>
        rand() / 0xffff_ffff > 0.5);
      ref.range = [
        rand() % 100, rand() % 100,
        rand() % 100, rand() % 100,
      ];
    }
  }

  /** @type {any[]} */
  const allExpected = [

    {
      $id: 1,
      light: 193,
      pos: [0, 0],
      transform: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1.0, 0,
        0, 0, 0, 1,
      ],
      colors: {
        bg: [0, 0, 0, 0xff],
        fg: [0x10, 0x10, 0x10],
      },
      energy: undefined,
      stats: undefined,
      could: [
        1, 0, 1, 1, 0,
        1, 1, 0, 0, 0,
      ],
      range: [
        81, 89,
        93, 44,
      ],
    },

    {
      $id: 2,
      light: 176,
      pos: [0, 1],
      transform: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 2.0, 0,
        0, 0, 0, 1,
      ],
      colors: {
        bg: [0, 0, 0, 0xff],
        fg: [0x20, 0x20, 0x20],
      },
      energy: 7 * 2,
      stats: {
        hp: 50,
        con: 5,
        str: 3,
        dex: 11,
        int: 11,
        wis: 7,
        cha: 4,
      },
      could: undefined,
      range: undefined,
    },

    {
      $id: 3,
      light: 159,
      pos: [1, 0],
      transform: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 3.0, 0,
        0, 0, 0, 1,
      ],
      colors: {
        bg: [0, 0, 0, 0xff],
        fg: [0x30, 0x30, 0x30],
      },
      energy: undefined,
      stats: undefined,
      could: [
        0, 1, 0, 0, 0,
        1, 1, 1, 1, 1,
      ],
      range: [
        29, 65,
        24, 75,
      ],
    },

    {
      $id: 4,
      light: 142,
      pos: [1, 1],
      transform: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 4.0, 0,
        0, 0, 0, 1,
      ],
      colors: {
        bg: [0, 0, 0, 0xff],
        fg: [0x40, 0x40, 0x40],
      },
      energy: 7 * 4,
      stats: {
        hp: 70,
        con: 7,
        str: 1,
        dex: 6,
        int: 4,
        wis: 9,
        cha: 0,
      },
      could: undefined,
      range: undefined,
    },

  ];

  // readback object data set above
  t.deepEqual(copiedFrom(df), allExpected);

  t.deepEqual(new Uint8Array(
    df.aspects.light.buffer,
    0,
    df.aspects.light.buffer.byteLength
  ), Uint8Array.of(
    193,
    176,
    159,
    142,
  ));

  t.deepEqual(new Float32Array(
    df.aspects.pos.buffer,
    0,
    df.aspects.pos.length * 2,
  ), Float32Array.of(
    0, 0,
    0, 1,
    1, 0,
    1, 1,
  ));

  t.deepEqual(new Float32Array(
    df.aspects.transform.buffer,
    0,
    df.aspects.transform.length * 16,
  ), Float32Array.of(

    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,

    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 2, 0,
    0, 0, 0, 1,

    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 3, 0,
    0, 0, 0, 1,

    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 4, 0,
    0, 0, 0, 1,

  ));

  t.deepEqual(new Uint8Array(
    df.aspects.colors.buffer,
    0,
    df.aspects.colors.buffer.byteLength,
  ), Uint8Array.of(
    0x00, 0x00, 0x00, 0xff,
    0x10, 0x10, 0x10,
    0x00, 0x00, 0x00, 0xff,
    0x20, 0x20, 0x20,
    0x00, 0x00, 0x00, 0xff,
    0x30, 0x30, 0x30,
    0x00, 0x00, 0x00, 0xff,
    0x40, 0x40, 0x40,
  ));

  t.deepEqual(copiedFrom(df.aspects.energy.all()), [
    {
      $index: 0,
      $frameIndex: 1,
      value: 7 * 2,
    },
    {
      $index: 1,
      $frameIndex: 3,
      value: 7 * 4,
    },

  ]);

  t.deepEqual(new Uint32Array(
    df.aspects.energy.buffer,
    0,
    df.aspects.energy.length
  ), Uint32Array.of(
    7 * 2,
    7 * 4,
  ));

  t.deepEqual(myCopy(df.aspects.stats.getFor(df.toIndex(2))), {
    $index: 0,
    $frameIndex: 1,
    hp: 50,
    con: 5,
    str: 3,
    dex: 11,
    int: 11,
    wis: 7,
    cha: 4,
  });
  t.deepEqual(myCopy(df.aspects.stats.getFor(df.toIndex(4))), {
    $index: 1,
    $frameIndex: 3,
    hp: 70,
    con: 7,
    str: 1,
    dex: 6,
    int: 4,
    wis: 9,
    cha: 0,
  });

  t.deepEqual(new Uint8Array(
    df.aspects.stats.buffer,
    0,
    df.aspects.stats.buffer.byteLength
  ), Uint8Array.of(
    ...toHostOrder(0, 50),
    5,
    3,
    11,
    11,
    7,
    4,

    ...toHostOrder(0, 70),
    7,
    1,
    6,
    4,
    9,
    0,
  ));

  t.deepEqual(new Uint8Array(
    df.aspects.could.buffer,
    0,
    df.aspects.could.buffer.byteLength
  ), Uint8Array.of(
    1, 0, 1, 1, 0,
    1, 1, 0, 0, 0,

    0, 1, 0, 0, 0,
    1, 1, 1, 1, 1,
  ));

  t.deepEqual(new Float32Array(
    df.aspects.range.buffer,
    0,
    df.aspects.range.length * 4
  ), Float32Array.of(
    81, 89,
    93, 44,

    29, 65,
    24, 75,
  ));

  {
    const cur = df.aspects.light.get(0);

    t.deepEqual(cur, { $id: 1, value: 193 });

    cur.$index = 3;
    t.deepEqual(cur, { $id: 4, value: 142 });

    cur.$index = 4;
    t.deepEqual(cur, { $id: 5, value: undefined });
  }

  t.deepEqual(valuesFrom(df.aspects.light), [
    193,
    176,
    159,
    142,
  ]);

  t.deepEqual(valuesFrom(df.aspects.pos), [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]);

  {
    const cur = df.aspects.stats.get(0);

    t.deepEqual(cur, {
      $index: 0,
      $frameIndex: 1,
      hp: 50,
      con: 5,
      str: 3,
      dex: 11,
      int: 11,
      wis: 7,
      cha: 4,
    });

    cur.$index = 1;
    t.deepEqual(cur, {
      $index: 1,
      $frameIndex: 3,
      hp: 70,
      con: 7,
      str: 1,
      dex: 6,
      int: 4,
      wis: 9,
      cha: 0,
    });
  }

  t.deepEqual(copiedFrom(df.aspects.stats), [
    {
      $index: 0,
      $frameIndex: 1,
      hp: 50,
      con: 5,
      str: 3,
      dex: 11,
      int: 11,
      wis: 7,
      cha: 4,
    },

    {
      $index: 1,
      $frameIndex: 3,
      hp: 70,
      con: 7,
      str: 1,
      dex: 6,
      int: 4,
      wis: 9,
      cha: 0,
    },

  ]);

  // resize grow again, old data still valid, new itmes avail
  df.resize(6);
  allExpected.push(
    {
      $id: 5,
      light: 0,
      pos: [0, 0],
      transform: [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      colors: {
        bg: [0, 0, 0, 0],
        fg: [0, 0, 0],
      },
      energy: undefined,
      stats: undefined,
      could: undefined,
      range: undefined,
    },
    {
      $id: 6,
      light: 0,
      pos: [0, 0],
      transform: [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      colors: {
        bg: [0, 0, 0, 0],
        fg: [0, 0, 0],
      },
      energy: undefined,
      stats: undefined,
      could: undefined,
      range: undefined,
    },
  );
  t.deepEqual(copiedFrom(df), allExpected);

  // TODO resize shrink...
  // TODO test ref retention

  // TODO df.clear

});

test('monotonic dataframe indexing', t => {
  const df = makeDataFrame(MonotonicIndex, { dat: 'uint8' }, 4);
  t.is(df.ref(0)?.$index, undefined);
  t.is(df.ref(1)?.$index, 0);
  t.is(df.ref(2)?.$index, 1);
  t.is(df.ref(3)?.$index, 2);
  t.is(df.ref(4)?.$index, 3);
  t.is(df.ref(5)?.$index, undefined);
  // TODO after resize? use dat?
});

test('xy spatial dataframe', t => {
  const df = makeDataFrame(makeXYIndex(), { dat: 'uint8' }, [2, 2]);

  for (const at of /** @type {[x: number, y: number][]} */ ([
    [-1, 0],
    [0, -1],
    [-1, -1],
    [2, 1],
    [1, 2],
    [2, 2],
  ])) t.is(df.ref(at)?.$index, undefined, `expected ${at} to be undefined`);

  for (const [i, x, y] of /** @type {[i: number, x: number, y: number][]} */ ([
    [0, 0, 0],
    [1, 1, 0],
    [2, 0, 1],
    [3, 1, 1],
  ])) {
    const ref = df.ref([x, y]);
    t.is(ref?.$index, i);
    t.is(ref?.$x, x);
    t.is(ref?.$y, y);
    t.deepEqual(ref?.$xy, [x, y]);
  }

  for (const [x, y, d] of /** @type {[i: number, x: number, y: number][]} */ ([
    [0, 0, 7],
    [1, 0, 14],
    [0, 1, 21],
    [1, 1, 28],
  ])) {
    const ref = df.ref([x, y]);
    if (!t.truthy(ref, `must have ref @${[x, y]}`) || !ref) continue;
    t.deepEqual(ref.$xy, [x, y]);
    ref.dat = d;

    const aref = df.aspects.dat.ref([x, y]);
    if (!t.truthy(aref, `must have ref @${[x, y]}`) || !aref) continue;
    t.deepEqual(aref.$xy, [x, y]);
    t.is(aref.value, d);
  }

  t.deepEqual(copiedFrom(df), [
    { $x: 0, $y: 0, $xy: [0, 0], dat: 7 },
    { $x: 1, $y: 0, $xy: [1, 0], dat: 14 },
    { $x: 0, $y: 1, $xy: [0, 1], dat: 21 },
    { $x: 1, $y: 1, $xy: [1, 1], dat: 28 },
  ]);

  t.deepEqual(copiedFrom(df.aspects.dat), [
    { $x: 0, $y: 0, $xy: [0, 0], value: 7 },
    { $x: 1, $y: 0, $xy: [1, 0], value: 14 },
    { $x: 0, $y: 1, $xy: [0, 1], value: 21 },
    { $x: 1, $y: 1, $xy: [1, 1], value: 28 },
  ]);

  df.resize([3, 2]);
  t.is(df.length, 6);
  t.deepEqual(copiedFrom(df), [
    { $x: 0, $y: 0, $xy: [0, 0], dat: 7 },
    { $x: 1, $y: 0, $xy: [1, 0], dat: 14 },
    { $x: 2, $y: 0, $xy: [2, 0], dat: 0 },
    { $x: 0, $y: 1, $xy: [0, 1], dat: 21 },
    { $x: 1, $y: 1, $xy: [1, 1], dat: 28 },
    { $x: 2, $y: 1, $xy: [2, 1], dat: 0 },
  ]);

  df.resize([2, 3]);
  t.is(df.length, 6);
  t.deepEqual(copiedFrom(df), [
    { $x: 0, $y: 0, $xy: [0, 0], dat: 7 },
    { $x: 1, $y: 0, $xy: [1, 0], dat: 14 },
    { $x: 0, $y: 1, $xy: [0, 1], dat: 21 },
    { $x: 1, $y: 1, $xy: [1, 1], dat: 28 },
    { $x: 0, $y: 2, $xy: [0, 2], dat: 0 },
    { $x: 1, $y: 2, $xy: [1, 2], dat: 0 },
  ]);
});

/** @template T, U
 * @param {Iterable<T>|Iterator<T>} things
 * @param {(t: T) => U} fn
 */
function* imap(things, fn) {
  const it = 'next' in things ? things : things[Symbol.iterator]();
  for (let res = it.next(); !res.done; res = it.next())
    yield fn(res.value);
}

/** @param {any} thing @returns {any} */
const myCopy = thing => {
  // not only does this do a deep copy, it also "denatures" all arrays
  if (typeof thing == 'object' && thing != null && Symbol.iterator in thing)
    return copiedFrom(thing);
  if (typeof thing == 'object')
    return Object.fromEntries(Object.entries(thing)
      .map(([k, v]) => [k, myCopy(v)]));
  return thing;
};

/** @param {any} things @returns {any} */
const copiedFrom = things => Array.from(imap(things, myCopy));

/** @template V @template {{value: V}} T
 * @param {Iterable<T>|Iterator<T>} things
 * */
const valuesFrom = things => Array.from(imap(things, ({ value }) => myCopy(value)));
