import test from 'ava';
import { makeScaffold } from '../test-scaffold.js';

test('equatorial eastward walk', t => {
  const s = makeScaffold(t, {
    legend: {
      M: 'mountain',
      I: 'palmIsland',
      B: 'bank',
    },
  });
  s.scene(
    `
    M M M
    . @ .
    M M M
  `,
    5,
  );
  s.scene(
    `
    I . I
    . . .
    I I I
  `,
    4,
  );
  s.scene(
    `
    . B .
    . . .
    . . .
  `,
    0,
  );
  s.scene(
    `
    . . M
    . . .
    M . .
  `,
    1,
  );
  s.stamina = 5;
  s.play();

  // TODO:
  s.expectScene(
    `
    M M M
    . @ . <- TODO weird that not starting in ecstatic mode
    M M M
  `,
    5,
  );

  s.command(6);
  s.expectScene(
    `
    M M M
    . . e
    M M M
  `,
    5,
  );

  s.command(6);
  s.expectScene(
    `
    M M M
    . . .
    M M M
  `,
    5,
  );
  s.expectScene(
    `
    I . I
    e . .
    I I I
  `,
    4,
  );

  s.command(6);
  s.expectScene(
    `
    I . I
    . e .
    I I I
  `,
    4,
  );

  s.command(6);
  s.expectScene(
    `
    I . I
    . . e
    I I I
  `,
    4,
  );

  s.command(6);
  s.expectScene(
    `
    I . I
    . . .
    I I I
  `,
    4,
  );
  s.expectScene(
    `
    . B .
    e . .
    . . .
  `,
    0,
  );

  s.command(6);
  s.expectScene(
    `
    . B .
    . e .
    . . .
  `,
    0,
  );

  s.command(6);
  s.expectScene(
    `
    . B .
    . . e
    . . .
  `,
    0,
  );

  s.command(6);
  s.expectScene(
    `
    . B .
    . . .
    . . .
  `,
    0,
  );
  s.expectScene(
    `
    . . M
    e . .
    M . .
  `,
    1,
  );

  s.command(6);
  s.expectScene(
    `
    . . M
    . e .
    M . .
  `,
    1,
  );

  s.command(6);
  s.expectScene(
    `
    . . M
    . . e
    M . .
  `,
    1,
  );

  s.command(6);
  s.expectScene(
    `
    . . M
    . . .
    M . .
  `,
    1,
  );
  s.expectScene(
    `
    M M M
    e . .
    M M M
  `,
    5,
  );
});

test('equatorial westward walk', t => {
  const s = makeScaffold(t, {
    legend: {
      M: 'mountain',
      I: 'palmIsland',
      B: 'bank',
    },
  });
  s.scene(
    `
    M M M
    . @ .
    M M M
  `,
    5,
  );
  s.scene(
    `
    I . I
    . . .
    I I I
  `,
    4,
  );
  s.scene(
    `
    . B .
    . . .
    . . .
  `,
    0,
  );
  s.scene(
    `
    . . M
    . . .
    M . .
  `,
    1,
  );
  s.stamina = 5;
  s.play();

  // TODO:
  s.expectScene(
    `
    M M M
    . @ . <- TODO weird that not starting in ecstatic mode
    M M M
  `,
    5,
  );

  s.command(4); // west
  s.expectScene(
    `
    M M M
    e . .
    M M M
  `,
    5,
  );

  s.command(4); // west
  s.expectScene(
    `
    . . M
    . . e
    M . .
  `,
    1,
  );

  s.command(4); // west
  s.expectScene(
    `
    . . M
    . e .
    M . .
  `,
    1,
  );

  s.command(4); // west
  s.expectScene(
    `
    . . M
    e . .
    M . .
  `,
    1,
  );

  s.command(4); // west
  s.expectScene(
    `
    . B .
    . . e
    . . .
  `,
    0,
  );

  s.command(4); // west
  s.expectScene(
    `
    . B .
    . e .
    . . .
  `,
    0,
  );

  s.command(4); // west
  s.expectScene(
    `
    . B .
    e . .
    . . .
  `,
    0,
  );

  s.command(4); // west
  s.expectScene(
    `
    I . I
    . . e
    I I I
  `,
    4,
  );

  s.command(4); // west
  s.expectScene(
    `
    I . I
    . e .
    I I I
  `,
    4,
  );

  s.command(4); // west
  s.expectScene(
    `
    I . I
    e . .
    I I I
  `,
    4,
  );

  s.command(4); // west
  s.expectScene(
    `
    M M M
    . . e
    M M M
  `,
    5,
  );
});

test('boreal polar walks', t => {
  const s = makeScaffold(t, {
    legend: {
      M: 'mountain',
      I: 'palmIsland',
      B: 'bank',
    },
  });
  s.scene(
    `
    M . M
    M . .
    M M M
  `,
    5,
  );
  s.scene(
    `
    I . I
    . . I
    I . I
  `,
    4,
  );
  s.scene(
    `
    M . M
    . @ .
    M . M
  `,
    3,
  );
  s.scene(
    `
    . . .
    . B .
    . . .
  `,
    0,
  );
  s.scene(
    `
    . . M
    . . .
    M . .
  `,
    1,
  );
  s.scene(
    `
    . . M
    . . .
    M . M
  `,
    2,
  );
  s.stamina = 5;
  s.play();

  s.expectScene(
    `
    M . M
    . @ .
    M . M
  `,
    3,
  );

  s.command(8); // north
  s.expectScene(
    `
    M e M
    . . .
    M . M
  `,
    3,
  );

  s.command(8); // north
  s.expectScene(
    `
    . e M
    . . . <- oria
    M . .
  `,
    1,
  );

  s.command(8); // north
  s.expectScene(
    `
    M e M
    . . .
    M . M
  `,
    3,
  );

  s.command(2); // south
  s.command(6); // east
  s.command(6); // east
  s.expectScene(
    `
    . e . <- enter at top
    . B .
    . . .
  `,
    0,
  );

  s.command(8); // north
  s.expectScene(
    `
    M . M
    . . e
    M . M
  `,
    3,
  );

  s.command(4); // west
  s.command(2); // south
  s.command(2); // south
  s.expectScene(
    `
    I e I <- enter top
    . . I
    I . I
  `,
    4,
  );

  s.command(8); // north
  s.expectScene(
    `
    M . M
    . . .
    M e M
  `,
    3,
  );

  s.command(8); // north
  s.command(4); // west
  s.command(4); // west
  s.expectScene(
    `
    M e M <- enter top
    M . .
    M M M
  `,
    5,
  );

  s.command(8); // north
  s.expectScene(
    `
    M . M
    e . .
    M . M
  `,
    3,
  );
});

test('infernal polar walks', t => {
  const s = makeScaffold(t, {
    legend: {
      M: 'mountain',
      I: 'palmIsland',
      B: 'bank',
    },
  });
  s.scene(
    `
    M . M
    M . M
    M . M
  `,
    5,
  );
  s.scene(
    `
    I . I
    . . I
    I . I
  `,
    4,
  );
  s.scene(
    `
    M . M
    . . .
    M . M
  `,
    3,
  );
  s.scene(
    `
    . . .
    . B .
    . . .
  `,
    0,
  );
  s.scene(
    `
    . . M
    . . .
    M . .
  `,
    1,
  );
  s.scene(
    `
    . . M
    . @ .
    M . M
  `,
    2,
  );
  s.stamina = 5;
  s.play();

  s.expectScene(
    `
    . . M
    . @ .
    M . M
  `,
    2,
  );

  s.command(8); // north
  s.expectScene(
    `
    . e M
    . . .
    M . M
  `,
    2,
  );

  s.command(8); // north
  s.expectScene(
    `
    . . M
    . . . <- oria
    M e . <- enter at bottom
  `,
    1,
  );

  s.command(2); // south
  s.expectScene(
    `
    . e M
    . . .
    M . M
  `,
    2,
  );

  s.command(2); // south
  s.command(6); // east
  s.command(6); // east
  s.expectScene(
    `
    M . M
    M . M <- euia
    M e M <- enter bottom
  `,
    5,
  );

  s.command(2); // south
  s.expectScene(
    `
    . . M
    . . e <- infra
    M . M
  `,
    2,
  );

  s.command(4); // west
  s.command(2); // south
  s.command(2); // south
  s.expectScene(
    `
    I . I
    . . I
    I e I <- enter at bottom
  `,
    4,
  );

  s.command(2); // south
  s.expectScene(
    `
    . . M
    . . . <- infra
    M e M
  `,
    2,
  );

  s.command(8); // north
  s.command(4); // west
  s.command(4); // west
  s.expectScene(
    `
    . . .
    . B . <- dysia
    . e . <- enter at bottom
  `,
    0,
  );

  s.command(2); // south
  s.expectScene(
    `
    . . M
    e . . <- infra
    M . M
  `,
    2,
  );
});
