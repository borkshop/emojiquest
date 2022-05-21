import test from 'ava';
import url from 'url';
import fs from 'fs/promises';
import { makeScaffold } from './test-scaffold.js';

test('limbo', t => {
  const s = makeScaffold(t);
  s.expectControls(`
    . . .
    . . .
    . . .
  `);
  s.expectScene(`
    . . .
    . . .
    . . .
  `);
});

test('play', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  s.expectScene(`
    @ . .
    . . .
    . . .
  `);
});

test('rest', t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ .
    . . .
  `);
  s.play();
  s.command(5); // rest
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  s.expectScene(`
    . . .
    . @ .
    . . .
  `);
});

test('move', t => {
  const s = makeScaffold(t);
  s.scene(`
    @ . .
    . . .
    . . .
  `);
  s.play();

  s.expectScene(`
    @ . .
    . . .
    . . .
  `);

  s.command(6); // east
  s.expectScene(`
    . @ .
    . . .
    . . .
  `);

  s.command(2); // south
  s.expectScene(`
    . . .
    . @ .
    . . .
  `);

  s.command(4); // west
  s.expectScene(`
    . . .
    @ . .
    . . .
  `);

  s.command(8); // north
  s.expectScene(`
    @ . .
    . . .
    . . .
  `);
});

test('the apple tree', t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ s
    < z >
    a v ]
  `);
  s.command(1); // select apple from left hand
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);
  t.is(s.health, 0);
  s.command(9); // eat the apple (move to mouth)
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  t.is(s.health, 1);
});

test('fill inventory', t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ s <- nothing in the pack
    < z >
    a v ] <- got an apple
  `);
  s.command(1); // select apple
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);
  s.command(7); // select pack
  s.expectControls(`
    7 8 9
    4 a 6 <- empty inventory
    1 2 3
  `);
  s.command(1); // move apple to pack
  for (const slot of [2, 3, 4, /* 5 is center */ 6, 7, 8, 9]) {
    s.expectControls(`
      b ^ s <- backpack no longer empty
      < z >
      [ v ]
    `);
    s.command(6); // bump tree to the east
    s.expectControls(`
      b ^ s <- pack is not empty
      < z >
      a v ] <- got an apple
    `);
    s.command(1); // select apple
    s.expectControls(`
      b . m  <- backpack and mouth show
      .(a).  <- reticle around apple
      [ . ]  <- empty hands, no D-pad
    `);
    s.command(7); // select pack
    // pack is not empty
    s.command(slot); // move apple to pack
  }

  s.command(7); // open pack
  s.expectControls(`
    a a a
    a . a <- lots of apples
    a a a
  `);
  s.command(5); // go back

  s.command(6); // get an apple
  s.expectControls(`
    b ^ s <- full pack
    < z >
    a v ] <- got an apple
  `);

  s.command(1); // select apple
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  s.command(7); // open pack
  s.expectControls(`
    a a a
    a a a <- more apples
    a a a
  `);

  s.command(5); // go back
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);

  s.command(3); // put apple in right hand
  s.expectControls(`
    b ^ s <- full pack
    < z >
    [ v a <- apple in right hand
  `);

  s.command(6); // one last apple
  s.expectControls(`
    b ^ s <- full pack of apples
    < z >
    a v a <- lots of apples
  `);
});

test('juggling', t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  s.command(6); // bump the tree to get apple
  s.expectControls(`
    . ^ s
    < z >
    a v ]  <- apple in left hand
  `);

  s.command(1); // select apple from left hand
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  s.command(3); // move apple to right hand
  s.expectControls(`
    . ^ s
    < z >
    [ v a  <- apple in right hand
  `);

  s.command(6); // bump tree to get apple
  s.expectControls(`
    . ^ s
    < z >
    a v a  <-  apples in both hands
  `);

  s.command(1); // select apple in left hand
  s.expectControls(`
    b . m
    .(a).
    [ a ]
  `);

  s.command(9); // eat the apple, returns other applee to right hand
  s.expectControls(`
    . ^ s
    < z >
    [ v a <- apple in right hand
  `);
});

test('to and from pack with apple in left hand', t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  s.command(6); // get apple
  s.expectMode('play');
  s.expectControls(`
    . ^ s  <- pack is empty
    < z >
    a v ]  <- apple in left hand
  `);

  s.command(1); // select apple
  s.expectMode('item');
  s.command(7); // move to pack
  s.expectMode('pack');
  s.command(1); // put in slot 1
  s.expectControls(`
    b ^ s  <- apple is in backpack
    < z >
    [ v ]
  `);

  s.command(6); // get another apple
  s.expectControls(`
    b ^ s  <- other apple in pack
    < z >
    a v ]  <- apple in left hand
  `);

  s.command(7); // open pack
  s.expectMode('pack');
  s.command(1); // choose apple
  s.expectMode('item');
  s.command(9); // eat apple
  s.expectMode('play');
  s.expectControls(`
    . ^ s
    < z >
    a v ]  <- apple should return to left hand
  `);
  s.expectInventory(0, 'apple');
  s.expectInventory(1, 'empty');
});

test('to and from pack with apple in right hand', t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  s.command(6); // get apple
  s.expectMode('play');
  s.expectControls(`
    . ^ s  <- pack is empty
    < z >
    a v ]  <- apple in left hand
  `);

  s.command(1); // select apple
  s.expectMode('item');
  s.command(7); // move to pack
  s.expectMode('pack');
  s.command(1); // put in slot 1
  s.expectControls(`
    b ^ s  <- apple is in backpack
    < z >
    [ v ]
  `);

  s.command(6); // get another apple
  s.expectControls(`
    b ^ s  <- other apple in pack
    < z >
    a v ]  <- apple in left hand
  `);

  s.command(1); // get apple
  s.expectMode('item');
  s.command(3); // place aple in right hand
  s.expectControls(`
    b ^ s  <- other apple in pack
    < z >
    [ v a  <- apple in right hand
  `);

  s.command(7); // open pack
  s.expectMode('pack');
  s.command(1); // choose apple
  s.expectMode('item');
  s.command(9); // eat apple
  s.expectMode('play');
  s.expectControls(`
    . ^ s  <- pack should be empty
    < z >
    [ v a  <- apple should return to right hand
  `);
  s.expectInventory(0, 'empty');
  s.expectInventory(1, 'apple');
});

test('menu', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.expectButton('h'); // hamburger

  s.command(0); // menu
  s.expectButton('t'); // thumb's up
  s.expectControls(`
    . ^ .
    . . .
    . v .
  `);

  s.command(0); // return to play
  s.expectButton('h'); // thumb's up
  s.expectScene(`
    @ . .
    . . .
    . . .
  `);
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
});

// This of course covers restoration, but is also a useful utility for ad-hoc
// test failure isolation and reproduction.
test('restore', async t => {
  const path = url.fileURLToPath(new URL('daia.json', import.meta.url));
  const text = await fs.readFile(path, 'utf8');
  const json = JSON.parse(text);

  const s = makeScaffold(t, { size: 81 });
  s.restore(json);
  s.play();

  s.expectMode('play');
});
