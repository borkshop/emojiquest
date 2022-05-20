import test from 'ava';
import { makeScaffold } from './test-scaffold.js';

test('limbo', t => {
  const s = makeScaffold(t);
  s.expectControls(`
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
});

test('rest', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();
  s.command(5); // rest
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
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
