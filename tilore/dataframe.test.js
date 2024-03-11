// @ts-check

import test from 'ava';

import {
  makeDataFrame,
  makeSparseDataFrame,
  MonotonicIndex,
  makeXYIndex,
  makePermutation,
  permutationSwaps,
  icur,
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

test('sparse data compaction', t => {
  const df = makeDataFrame(MonotonicIndex, { dat: { sparse: 'uint8' } }, 4);

  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: undefined },
    { $id: 3, dat: undefined },
    { $id: 4, dat: undefined },
  ]);
  t.deepEqual(copiedFrom(df.aspects.dat), []);

  df.get(1).dat = 7;
  df.get(3).dat = 21;
  df.get(0).dat = 0;
  df.get(2).dat = 14;
  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: 0 },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: 21 },
  ]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $index }) => $index)), [0, 1, 2, 3]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $frameIndex }) => $frameIndex)), [1, 3, 0, 2]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ value }) => value)), [7, 21, 0, 14]);

  {
    const ref = df.aspects.dat.getFor(0);
    if (!ref) {
      t.fail('must have dat ref for $frameIndex:0');
      return;
    }

    t.is(ref.value, 0);
    t.is(ref.$frameIndex, 0);
    t.is(ref.$index, 2);

    t.is(df.aspects.dat.capacity, 4);
    t.is(df.aspects.dat.length, 4);
    ref.$frameIndex = undefined;
    t.is(df.aspects.dat.capacity, 4);
    t.is(df.aspects.dat.length, 3);
  }

  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: 21 },
  ]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $index }) => $index)), [0, 1, 3]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $frameIndex }) => $frameIndex)), [1, 3, 2]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ value }) => value)), [7, 21, 14]);

  df.get(3).dat = undefined;

  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
  ]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $index }) => $index)), [0, 3]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $frameIndex }) => $frameIndex)), [1, 2]);
  t.deepEqual(copiedFrom(df.aspects.dat).map(({ value }) => value), [7, 14]);

  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 21, 0, 14));
  df.aspects.dat.compact();
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 0, 21));

  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
  ]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $index }) => $index)), [0, 1]);
  t.deepEqual(Array.from(imap(df.aspects.dat, ({ $frameIndex }) => $frameIndex)), [1, 2]);
  t.deepEqual(copiedFrom(df.aspects.dat).map(({ value }) => value), [7, 14]);

  df.resize(6);

  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
    { $id: 5, dat: undefined },
    { $id: 6, dat: undefined },
  ]);
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 0, 21));

  df.get(5).dat = 35;
  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
    { $id: 5, dat: undefined },
    { $id: 6, dat: 35 },
  ]);
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 35, 21));

  df.get(0).dat = 0;
  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: 0 },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
    { $id: 5, dat: undefined },
    { $id: 6, dat: 35 },
  ]);
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 35, 0));

  df.get(4).dat = 28;
  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: 0 },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: undefined },
    { $id: 5, dat: 28 },
    { $id: 6, dat: 35 },
  ]);
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 35, 0, 28, 0, 0, 0));

  df.get(0).dat = undefined;
  df.get(3).dat = 21;
  t.deepEqual(copiedFrom(df), [
    { $id: 1, dat: undefined },
    { $id: 2, dat: 7 },
    { $id: 3, dat: 14 },
    { $id: 4, dat: 21 },
    { $id: 5, dat: 28 },
    { $id: 6, dat: 35 },
  ]);
  t.deepEqual(
    new Uint8Array(df.aspects.dat.buffer),
    Uint8Array.of(7, 14, 35, 21, 28, 0, 0, 0));
});

test('dense order', t => {
  const df = makeDataFrame(MonotonicIndex, {
    draw: { order: 'self' },
  }, 8);

  t.is(df.aspects.draw.length, 8);

  /** @param {number[]} orders */
  const expect = (...orders) => {
    const { length } = orders;
    const elements = new Uint8Array(length);
    for (let i = 0; i < length; i++)
      elements[orders[i]] = i;
    t.deepEqual(Array.from(imap(df, ({ draw }) => draw)), [...orders]);
    t.deepEqual(new Uint8Array(df.aspects.draw.buffer), elements);
  };

  expect(0, 1, 2, 3, 4, 5, 6, 7);

  df.get(3).draw = 6;
  expect(0, 1, 2, 6, 4, 5, 3, 7);

  df.get(3).draw = 5;
  expect(0, 1, 2, 5, 4, 6, 3, 7);
});

test('sparse order', t => {
  const df = makeDataFrame(MonotonicIndex, {
    draw: { sparse: { order: 'self' } },
  }, 8);

  /** @param {number[]} data */
  const expect = (...data) => {
    const
      order = df.aspects.draw,
      { length, byteStride, buffer } = order;

    if (!t.is(length, data.length))
      return false;

    if (!t.deepEqual(Array.from(imap(order,
      ({ $frameIndex }) => $frameIndex)), [...data]))
      return false;

    // need to compact to stabilize byte representation...
    order.compact();

    // ...but we then also recheck formal length and accessor data
    if (!t.is(length, data.length))
      return false;
    if (!t.deepEqual(Array.from(imap(order,
      ({ $frameIndex }) => $frameIndex)), [...data]))
      return false;

    // ... before finally checking the compacted byte representation
    if (!t.deepEqual(
      new Uint8Array(buffer).subarray(0, length * byteStride),
      Uint8Array.of(...data)))
      return false;

    return true;
  };

  expect();

  df.get(1).draw = Infinity;
  if (!expect(1)) return;

  df.get(2).draw = Infinity;
  if (!expect(1, 2)) return;

  df.get(3).draw = Infinity;
  if (!expect(1, 2, 3)) return;

  df.get(7).draw = 1;
  if (!expect(1, 7, 3, 2)) return;

  if (!t.deepEqual(Array.from(imap(df, ({ $id, draw }) => ({ $id, draw }))), [
    { $id: 1, draw: undefined },
    { $id: 2, draw: 0 },
    { $id: 3, draw: 3 },
    { $id: 4, draw: 2 },
    { $id: 5, draw: undefined },
    { $id: 6, draw: undefined },
    { $id: 7, draw: undefined },
    { $id: 8, draw: 1 },
  ])) return;

  df.get(3).draw = undefined;
  if (!expect(1, 7, 2)) return;

  df.get(5).draw = Infinity;
  if (!expect(1, 7, 2, 5)) return;

  df.get(2).draw = undefined;
  df.get(6).draw = Infinity;
  if (!expect(1, 7, 5, 6)) return;
});

test('sparse dataframe', t => {
  const df = makeSparseDataFrame(MonotonicIndex, {
    dat: 'uint8',
    sat: { sparse: 'uint8' },
    total: { order: 'self' },
    partial: { sparse: { order: 'self' } },
  });

  /**
   * @template {{[key: string]: any}} T
   * @param {T[]} data
   */
  const load = (...data) => {
    t.log(`*** LOAD ${data.length} entries ***`);
    /** @type {number[]} */
    const loaded = [];

    const validate = () => {
      for (let i = 0; i < loaded.length; i++) {
        const $id = loaded[i];
        const ref = df.ref($id);
        if (!t.like(ref, data[i], `validate loaded[${i}] $id:${$id}`))
          return false;
      }
      return true;
    };

    df.capacity = df.length + data.length;
    for (const datum of data) {
      const ref = df.alloc();
      if (!validate()) {
        t.log(`alloc #${ref.$id} invalidated`);
        return false;
      }

      Object.assign(ref, datum);
      if (!t.like(ref, datum)) {
        t.log(`load failed $id:${ref.$id}`);
        return;
      }

      t.log(`loaded $id:${ref.$id} <- ${JSON.stringify(datum)}`);

      loaded.push(ref.$id);
      if (!validate()) return false;
    }

    return true;
  };

  /** @param {({[key: string]: any} & {$id: number})[]} records */
  const expect = (...records) => {
    let ok = true;
    t.log(`*** EXPECT ${records.length} records ***`);
    const byID = new Map(records.map(({ $id, ...rest }) => [$id, rest]));
    for (const rec of df) {
      const { $id, ...rest } = rec;
      const expect = byID.get($id);
      if (expect == undefined) {
        t.log(`unexpected $id:${$id}`, rest);
        t.fail(`unexpected $id:${$id}`);
        ok = false;
      } else {
        byID.delete($id);
        if (!t.deepEqual(rest, expect, `expected data for $id:${$id}`))
          ok = false;
      }
    }

    if (byID.size > 0) {
      for (const [$id, expect] of byID)
        t.log(`missing $id:${$id}`, expect);
      t.fail(`missing ${byID.size} records`);
      ok = false;
    }

    return ok;
  };

  t.is(df.length, 0);
  t.is(df.capacity, 0);

  if (!load(
    { dat: 3, sat: 2 },
    { dat: 5, sat: 11 },
    { dat: 7 },
    { dat: 15, sat: 22 },
    { dat: 21, sat: 4 },
    { dat: 35 },
  )) return;
  t.is(df.length, 6);
  t.is(df.capacity, 8);
  expect(
    { $id: 1, dat: 3, sat: 2, total: 0, partial: undefined },
    { $id: 2, dat: 5, sat: 11, total: 1, partial: undefined },
    { $id: 3, dat: 7, sat: undefined, total: 2, partial: undefined },
    { $id: 4, dat: 15, sat: 22, total: 3, partial: undefined },
    { $id: 5, dat: 21, sat: 4, total: 4, partial: undefined },
    { $id: 6, dat: 35, sat: undefined, total: 5, partial: undefined },
  );

  // TODO reorder total

  t.log('*** FREE [1] ***');
  df.free(1);
  t.is(df.length, 5);
  t.is(df.capacity, 8);
  expect(
    { $id: 1, dat: 3, sat: 2, total: 0, partial: undefined },
    { $id: 3, dat: 7, sat: undefined, total: 2, partial: undefined },
    { $id: 4, dat: 15, sat: 22, total: 3, partial: undefined },
    { $id: 5, dat: 21, sat: 4, total: 4, partial: undefined },
    { $id: 6, dat: 35, sat: undefined, total: 5, partial: undefined },
  );

  if (!load(
    { dat: 9, sat: 8 },
    { dat: 14 },
    { dat: 27, sat: 16 },
    { dat: 28 },
  )) return;
  t.is(df.length, 9);
  t.is(df.capacity, 16);
  expect(
    { $id: 1, dat: 3, sat: 2, total: 0, partial: undefined },
    { $id: 2, dat: 9, sat: 8, total: 1, partial: undefined },
    { $id: 3, dat: 7, sat: undefined, total: 2, partial: undefined },
    { $id: 4, dat: 15, sat: 22, total: 3, partial: undefined },
    { $id: 5, dat: 21, sat: 4, total: 4, partial: undefined },
    { $id: 6, dat: 35, sat: undefined, total: 5, partial: undefined },
    { $id: 7, dat: 14, sat: undefined, total: 6, partial: undefined },
    { $id: 8, dat: 27, sat: 16, total: 7, partial: undefined },
    { $id: 9, dat: 28, sat: undefined, total: 8, partial: undefined },
  );

  // TODO test df.aspects.sparse.getFor more broadly
  t.is(df.aspects.sat.getFor(3)?.value, 22);
  t.is(df.aspects.sat.getFor(4)?.value, 4);

  // TODO use icur more broadly

  t.deepEqual(Array.from(icur(df.get(0), cur => cur.$used)), [
    true, true, true, true,
    true, true, true, true,
    true, false, false, false,
    false, false, false, false,
  ]);

  t.log('*** FREE [2, 4, 8] ***');
  df.free(2); // $id:3
  df.free(4); // $id:5
  df.free(8); // $id:9
  t.deepEqual(Array.from(icur(df.get(0), cur => cur.$used)), [
    true, true, false, true,
    false, true, true, true,
    false, false, false, false,
    false, false, false, false,
  ]);
  expect(
    { $id: 1, dat: 3, sat: 2, total: 0, partial: undefined },
    { $id: 2, dat: 9, sat: 8, total: 1, partial: undefined },
    { $id: 4, dat: 15, sat: 22, total: 3, partial: undefined },
    { $id: 6, dat: 35, sat: undefined, total: 5, partial: undefined },
    { $id: 7, dat: 14, sat: undefined, total: 6, partial: undefined },
    { $id: 8, dat: 27, sat: 16, total: 7, partial: undefined },
  );

  t.log('*** COMPACT ***');
  df.compact();
  t.deepEqual(Array.from(icur(df.get(0), cur => cur.$used)), [
    true, true, true, true,
    true, true, false, false,
    false, false, false, false,
    false, false, false, false,
  ]);
  expect(
    { $id: 1, dat: 3, sat: 2, total: 0, partial: undefined },
    { $id: 2, dat: 9, sat: 8, total: 1, partial: undefined },
    { $id: 3, dat: 15, sat: 22, total: 3, partial: undefined },
    { $id: 4, dat: 35, sat: undefined, total: 5, partial: undefined },
    { $id: 5, dat: 14, sat: undefined, total: 6, partial: undefined },
    { $id: 6, dat: 27, sat: 16, total: 7, partial: undefined },
  );

});

test('perm swaps', t => {
  for (const N of [3, 5, 7]) { // TODO moar?
    const data = makePermutation(N);
    for (const perm of allPermutations(N)) {
      for (let i = 0; i < N; i++) data[i] = i;
      for (const [i, j] of permutationSwaps(perm)) {
        const tmp = data[i];
        data[i] = data[j];
        data[j] = tmp;
      }
      if (!t.deepEqual([...data], [...perm])) {
        t.log(`failed for [${[...perm]}]`);
        for (const [i, j] of permutationSwaps(perm))
          t.log(`... (${i} ${j})`);
        t.log(`actual ${describePermutation(data)}`);
        t.log(`expected ${describePermutation(perm)}`);
        return;
      }
    }
  }

  /** @param {ArrayLike<number>} perm */
  function describePermutation(perm) {
    return Array
      .from(permutationCycles(perm))
      .map(cycle => `(${cycle.map(x => `${x}`).join(' ')})`)
      .join('·');
  }

  /** @param {ArrayLike<number>} perm */
  function* permutationCycles(perm) {
    /** @type {Set<number>} */
    const seen = new Set();
    for (let i = 0; i < perm.length; i++) {
      let j = perm[i];
      if (i == j) continue;
      if (seen.has(i)) continue;
      seen.add(i);
      const cycle = [i];
      while (j != i) {
        cycle.push(j)
        seen.add(j);
        j = perm[j];
      }
      yield cycle;
    }
  }

  /** @param {number} N */
  function* allPermutations(N) {
    // adapted from <https://rosettacode.org/wiki/Permutations#version_2>
    // generates all permutation on N
    // without resorting to recursion or temporary array slice/dicing

    let NBang = 1; // factorial
    for (let p = N; p > 1; p--) NBang *= p;

    // init permutation in descending order
    const perm = makePermutation(N);
    for (let i = 1; i <= N; i++) perm[i - 1] = N - i;

    while (NBang-- > 0) {
      yield perm.slice(0);

      let i = 1;
      while (perm[i] > perm[i - 1]) i++;

      let j = 0;
      while (perm[j] < perm[i]) j++;

      const tmp = perm[j];
      perm[j] = perm[i];
      perm[i] = tmp;

      i--;
      for (j = 0; j < i; i--, j++) {
        const tmp = perm[i];
        perm[i] = perm[j];
        perm[j] = tmp;
      }
    }
  }
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
