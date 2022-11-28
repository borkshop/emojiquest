import test from 'ava';
import { makeScaffold } from '../test-scaffold.js';

test('freeze to death', async t => {
  const s = makeScaffold(t);
  s.terrain(`
    c c c
    c c c
    c c c
  `);
  s.scene(`
    . . .
    . @ .
    . . .
  `);
  s.health = 5;

  s.play();
  s.expectScene(`
    . . .
    . c . <- cold!
    . . .
  `);
  t.is(s.health, 5);

  await s.command(5); // rest
  s.expectScene(`
    . . .
    . c . <- cold!
    . . .
  `);
  t.is(s.health, 4);

  await s.command(5); // rest
  s.expectScene(`
    . . .
    . s . <- sad!
    . . .
  `);
  t.is(s.health, 3);

  await s.command(5); // rest
  s.expectScene(`
    . . .
    . b . <- bad!
    . . .
  `);
  t.is(s.health, 2);

  await s.command(5); // rest
  s.expectScene(`
    . . .
    . g . <- grimmacing, near death.
    . . .
  `);
  t.is(s.health, 1);

  await s.command(5); // rest
  t.is(s.health, 0);
  s.expectScene(`
    . . .
    . d . <- dead nao
    . . .
  `);
});

test('freeze til don a coat', async t => {
  const s = makeScaffold(t, {
    legend: {
      C: 'coat',
    },
  });
  s.terrain(`
    c c c
    c c c
    c c c
  `);
  s.scene(`
    . . .
    . @ C
    . . .
  `);
  s.health = 5;

  s.play();
  s.expectScene(`
    . . .
    . c C <- cold!, coat
    . . .
  `);
  t.is(s.health, 5);

  await s.command(5); // rest
  t.is(s.health, 4);

  await s.command(6); // get coat
  t.is(s.health, 3);
  s.expectScene(`
    . . .
    . s . <- not so cold, just sad
    . . .
  `);

  await s.command(5); // rest
  t.is(s.health, 3);

  await s.command(5); // rest
  t.is(s.health, 3);
});
