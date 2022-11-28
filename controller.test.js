import test from 'ava';
import url from 'url';
import fs from 'fs/promises';
import { makeScaffold } from './test-scaffold.js';

test('limbo', async t => {
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

test('play', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  s.expectScene(`
    @ . .
    . . .
    . . .
  `);
});

test('rest', async t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ .
    . . .
  `);
  s.play();
  await s.command(5); // rest
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  s.expectScene(`
    . . .
    . @ .
    . . .
  `);
});

test('move', async t => {
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

  await s.command(6); // east
  s.expectScene(`
    . @ .
    . . .
    . . .
  `);

  await s.command(2); // south
  s.expectScene(`
    . . .
    . @ .
    . . .
  `);

  await s.command(4); // west
  s.expectScene(`
    . . .
    @ . .
    . . .
  `);

  await s.command(8); // north
  s.expectScene(`
    @ . .
    . . .
    . . .
  `);
});

test('the apple tree', async t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.health = 3;
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  await s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ .
    < z >
    a v ]
  `);
  await s.command(1); // select apple from left hand
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);
  t.is(s.health, 3);
  await s.command(9); // eat the apple (move to mouth)
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  t.is(s.health, 4);
});

test('the pear tree', async t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ P
    . . .
  `);
  s.stamina = 3;
  s.play();

  s.expectScene(`
    . . .
    . @ A  <- pear tree appears as apple tree tile
    . . .
  `);

  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  await s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ .
    < z >
    p v ]
  `);
  await s.command(1); // select pear from left hand
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(p).  <- reticle around pear
    [ . ]  <- empty hands, no D-pad
  `);
  t.is(s.stamina, 3);
  await s.command(9); // eat the pear (move to mouth)
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  t.is(s.stamina, 4);
});

test('trash inventory', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'silver');
  s.play();
  s.expectControls(`
    . ^ . <- nothing in the pack
    < z >
    s v ] <- have silver medal
  `);

  await s.command(1); // select medal
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(s).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);

  await s.command(9); // throw medal away
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
});

test('chop down a tree', async t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ A
    . . .
  `);
  s.inventory(0, 'axe');
  s.play();

  await s.command(6); // chop down tree
  s.expectScene(`
    . . .
    . @ .  <- no tree
    . . .
  `);
  s.expectInventory(0, 'axe');
  s.expectInventory(1, 'hardwood');
});

test('craft softwood over axe', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'axe');
  s.inventory(1, 'softwood');
  s.play();
  s.expectControls(`
    . ^ . <- nothing in the pack
    < z >
    a v l <- axe and softwood (as lumber tile)
  `);

  await s.command(3); // select softwood
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(l).  <- lumber (agent) over
    [ a ]  <- axe (reagent)
  `);

  await s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(n).  <- knitting needles (product) over
    [ a ]  <- axe (byproduct preserved reagent)
  `);
  s.expectInventory(0, 'knittingNeedles');
  s.expectInventory(1, 'axe');
});

test('craft axe from knife and hammer', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'knife');
  s.inventory(1, 'hammer');
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    k v h
  `);

  await s.command(1); // select knife
  s.expectControls(`
    b . t
    .(k).  <- knife (agent) over
    [ h ]  <- hammer (reagent)
  `);

  await s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(a).  <- axe
    [ . ]
  `);
  s.expectInventory(0, 'axe');
  s.expectInventory(1, 'empty');
});

test('craft axe over softwood', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'axe');
  s.inventory(1, 'softwood');
  s.play();
  s.expectControls(`
    . ^ . <- nothing in the pack
    < z >
    a v l <- axe and softwood (as lumber tile)
  `);

  await s.command(1); // select axe
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(a).  <- axe (agent) over
    [ l ]  <- softwood with lumber tile (reagent)
  `);

  await s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(n).  <- knitting needles (product) over
    [ a ]  <- axe (byproduct preserved agent)
  `);
  s.expectInventory(0, 'knittingNeedles');
  s.expectInventory(1, 'axe');
});

test('craft canoe', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'spoon');
  s.inventory(1, 'softwood');
  s.play();

  await s.command(1); // select spoon
  await s.command(2); // apply to softwood
  s.expectInventory(0, 'canoe');
  s.expectInventory(1, 'spoon');
  s.expectControls(`
    b . t  <- backpack and trash
    .(c).  <- canoe
    [ s ]  <- spoon
  `);
});

test('craft apple over apple', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(1, 'apple');
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    a v a
  `);

  await s.command(3); // select apple
  s.expectControls(`
    b . m
    .(a).  <- apple (agent) over
    [ a ]  <- apple (reagent)
  `);

  await s.command(2); // craft
  s.expectControls(`
    b . m
    .(p).  <- pear
    [ . ]
  `);
  s.expectInventory(0, 'pear');
  s.expectInventory(1, 'empty');
});

test('craft pineapple over pineapple fails', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'pineApple');
  s.inventory(1, 'pineApple');
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    p v p
  `);

  await s.command(3); // select pineApple
  s.expectControls(`
    b . m
    .(p).  <- pineApple (agent) over
    [ p ]  <- pineApple (reagent)
  `);

  await s.command(2); // craft
  // CRAFT FAILS
  s.expectControls(`
    b . m
    .(p).  <- pineApple
    [ p ]  <- pineApple
  `);
  s.expectInventory(0, 'pineApple');
  s.expectInventory(1, 'pineApple');
});

test('fill inventory', async t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();
  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);
  await s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ . <- nothing in the pack
    < z >
    a v ] <- got an apple
  `);
  await s.command(1); // select apple
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);
  await s.command(7); // select pack
  s.expectControls(`
    7 8 9
    4 a 6 <- empty inventory
    1 2 3
  `);
  await s.command(1); // move apple to pack
  for (const slot of [2, 3, 4, /* 5 is center */ 6, 7, 8, 9]) {
    s.expectControls(`
      b ^ . <- backpack no longer empty
      < z >
      [ v ]
    `);
    await s.command(6); // bump tree to the east
    s.expectControls(`
      b ^ . <- pack is not empty
      < z >
      a v ] <- got an apple
    `);
    await s.command(1); // select apple
    s.expectControls(`
      b . m  <- backpack and mouth show
      .(a).  <- reticle around apple
      [ . ]  <- empty hands, no D-pad
    `);
    await s.command(7); // select pack
    // pack is not empty
    await s.command(slot); // move apple to pack
  }

  await s.command(7); // open pack
  s.expectControls(`
    a a a
    a . a <- lots of apples
    a a a
  `);
  await s.command(5); // go back

  await s.command(6); // get an apple
  s.expectControls(`
    b ^ . <- full pack
    < z >
    a v ] <- got an apple
  `);

  await s.command(1); // select apple
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  await s.command(7); // open pack
  s.expectControls(`
    a a a
    a a a <- more apples
    a a a
  `);

  await s.command(5); // go back
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(a).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);

  await s.command(3); // put apple in right hand
  s.expectControls(`
    b ^ . <- full pack
    < z >
    [ v a <- apple in right hand
  `);

  await s.command(6); // one last apple
  s.expectControls(`
    b ^ . <- full pack of apples
    < z >
    a v a <- lots of apples
  `);
});

test('juggling clockwise', async t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  await s.command(6); // bump the tree to get apple
  s.expectControls(`
    . ^ .
    < z >
    a v ]  <- apple in left hand
  `);

  await s.command(1); // select apple from left hand
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  await s.command(3); // move apple to right hand
  s.expectControls(`
    . ^ .
    < z >
    [ v a  <- apple in right hand
  `);

  await s.command(6); // bump tree to get apple
  s.expectControls(`
    . ^ .
    < z >
    a v a  <-  apples in both hands
  `);

  await s.command(1); // select apple in left hand
  s.expectControls(`
    b . m
    .(a).
    [ a ]
  `);

  await s.command(9); // eat the apple, returns other applee to right hand
  s.expectControls(`
    . ^ .
    < z >
    [ v a <- apple in right hand
  `);
});

test('hot hands', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(1, 'apple');
  s.play();

  s.expectControls(`
    . ^ .
    < z >
    [ v a  <- apple in right hand
  `);

  await s.command(3); // select apple from right hand
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  await s.command(1); // move apple to left hand
  s.expectControls(`
    . ^ .
    < z >
    a v ]  <- apple in left hand
  `);

  // a pineapple mysteriously appears in other hand
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ .
    < z >
    a v p  <-
  `);

  await s.command(1); // select apple from left hand
  s.expectControls(`
    b . m
    .(a).
    [ p ]
  `);

  await s.command(1); // put apple back in the left
  s.expectControls(`
    . ^ .
    < z >
    a v p  <-
  `);

  await s.command(1); // select apple from left hand, again
  s.expectControls(`
    b . m
    .(a).
    [ p ]
  `);

  await s.command(3); // switch apple to right hand, pineapple to left
  s.expectControls(`
    . ^ .
    < z >
    p v a  <-
  `);
});

test('to and from pack with apple in left hand', async t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  await s.command(6); // get apple
  s.expectMode('play');
  s.expectControls(`
    . ^ .  <- pack is empty
    < z >
    a v ]  <- apple in left hand
  `);

  await s.command(1); // select apple
  s.expectMode('item');
  await s.command(7); // move to pack
  s.expectMode('pack');
  await s.command(1); // put in slot 1
  s.expectControls(`
    b ^ .  <- apple is in backpack
    < z >
    [ v ]
  `);

  await s.command(6); // get another apple
  s.expectControls(`
    b ^ .  <- other apple in pack
    < z >
    a v ]  <- apple in left hand
  `);

  await s.command(7); // open pack
  s.expectMode('pack');
  await s.command(1); // choose apple
  s.expectMode('item');
  await s.command(9); // eat apple
  s.expectMode('play');
  s.expectControls(`
    . ^ .
    < z >
    a v ]  <- apple should return to left hand
  `);
  s.expectInventory(0, 'apple');
  s.expectInventory(1, 'empty');
});

test('to and from pack with apple in right hand', async t => {
  const s = makeScaffold(t);
  s.scene('@ A');
  s.play();

  await s.command(6); // get apple
  s.expectMode('play');
  s.expectControls(`
    . ^ .  <- pack is empty
    < z >
    a v ]  <- apple in left hand
  `);

  await s.command(1); // select apple
  s.expectMode('item');
  await s.command(7); // move to pack
  s.expectMode('pack');
  await s.command(1); // put in slot 1
  s.expectControls(`
    b ^ .  <- apple is in backpack
    < z >
    [ v ]
  `);

  await s.command(6); // get another apple
  s.expectControls(`
    b ^ .  <- other apple in pack
    < z >
    a v ]  <- apple in left hand
  `);

  await s.command(1); // get apple
  s.expectMode('item');
  await s.command(3); // place aple in right hand
  s.expectControls(`
    b ^ .  <- other apple in pack
    < z >
    [ v a  <- apple in right hand
  `);

  await s.command(7); // open pack
  s.expectMode('pack');
  await s.command(1); // choose apple
  s.expectMode('item');
  await s.command(9); // eat apple
  s.expectMode('play');
  s.expectControls(`
    . ^ .  <- pack should be empty
    < z >
    [ v a  <- apple should return to right hand
  `);
  s.expectInventory(0, 'empty');
  s.expectInventory(1, 'apple');
});

test('from pack with empty hands', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(2, 'apple');
  s.play();

  s.expectControls(`
    b ^ .
    < z >
    [ v ]
  `);

  await s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);

  await s.command(1); // choose apple
  s.expectControls(`
    b . m  <- mouth, backpack is empty, but a valid stash target
    .(a).
    [ . ]
  `);

  await s.command(9); // eat the apple
  s.expectControls(`
    . ^ .  <- pack is empty again
    < z >
    [ v ]  <- nothing in hand
  `);
});

test('from pack with empty hands, selecting empty pack position is no-op', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(2, 'apple');
  s.play();

  s.expectControls(`
    b ^ .
    < z >
    [ v ]
  `);

  await s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);

  s.expectMode('pack');
  await s.command(2); // no-op for empty slot if no item in hand
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);
});

test('to pack mode with an empty right hand', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(2, 'bolt');
  s.play();

  s.expectControls(`
    b ^ .
    < z >
    a v ]
  `);

  await s.command(7); // open the backpack
  // with both hands full, the controls arbitrarily
  // select to promote the left hand to the center
  s.expectControls(`
    7 8 9
    4 . 6  <- empty
    b 2 3  <- bolt
  `);

  await s.command(1); // select bolt
  s.expectControls(`
    b . t  <- pack and trash are valid targets
    .(b).  <- bolt held
    [ a ]  <- apple still here
  `);
});

test('to pack mode with full hands', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(1, 'pineApple');
  s.inventory(2, 'bolt');
  s.play();

  s.expectControls(`
    b ^ .
    < z >
    a v p
  `);

  await s.command(7); // open the backpack
  // with both hands full, the controls arbitrarily
  // select to promote the left hand to the center
  s.expectControls(`
    7 8 9
    4 a 6  <- apple
    b 2 3  <- bolt
  `);
});

test('to and from pack with full hands, left bias', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);

  // manus et malum
  s.inventory(0, 'apple');
  s.expectControls(`
    . ^ .
    < z >
    a v ]
  `);

  // immaculate reception
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ .
    < z >
    a v p
  `);

  await s.command(1); // take apple from left hand
  s.expectControls(`
    b . m  <- backpack shows
    .(a).  <- reticle around apple
    [ p ]  <- empty hands, pineapple in limbo
  `);

  await s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 a 6
    1 2 3
  `);

  await s.command(5); // close pack
  s.expectControls(`
    b . m
    .(a).
    [ p ]  <- pineapple in limbo, but originally from right
  `);

  await s.command(7); // reopen pack
  s.expectControls(`
    7 8 9
    4 a 6
    1 2 3
  `);

  await s.command(7); // stow in slot 7
  s.expectControls(`
    b ^ .
    < z >
    [ v p  <- pineapple returns to right hand
  `);
});

test('fail to open empty pack', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  await s.command(7);
  s.expectMode('play');
});

test('to and from pack with full hands, right bias', async t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.expectControls(`
    . ^ .
    < z >
    [ v ]
  `);

  // manus et malum
  s.inventory(0, 'apple');
  s.expectControls(`
    . ^ .
    < z >
    a v ]
  `);

  // immaculate reception
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ .
    < z >
    a v p
  `);

  await s.command(3); // take pineapple from right hand
  s.expectControls(`
    b . m  <- backpack shows
    .(p).  <- reticle around pineapple
    [ a ]  <- empty hands, apple in limbo
  `);

  await s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 p 6
    1 2 3
  `);

  await s.command(5); // close pack
  s.expectControls(`
    b . m  <- backpack shows
    .(p).  <- reticle around pineapple
    [ a ]  <- empty hands, apple in limbo
  `);

  await s.command(7); // reopen pack
  s.expectControls(`
    7 8 9
    4 p 6
    1 2 3
  `);

  await s.command(9); // stow in slot 9
  s.expectControls(`
    b ^ .
    < z >
    a v ]  <- apple returns to left hand
  `);
});

test('medal shop', async t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    B @ F
    . M .
  `);
  s.inventory(0, 'pick');
  s.play();

  // mine copper until pack is full
  for (const slot of [1, 2, 3, 4, 6, 7, 8, 9]) {
    s.expectMode('play');

    await s.command(2); // get copper
    s.expectMode('play');
    s.expectInventory(1, 'copper');

    await s.command(3); // select copper
    s.expectMode('item');
    await s.command(7);
    s.expectMode('pack');
    await s.command(slot); // store
  }

  s.expectMode('play');
  await s.command(7); // open pack
  s.expectMode('pack');
  s.expectControls(`
    c c c
    c . c
    c c c
  `);

  await s.command(5); // dismiss pack
  await s.command(1); // hold pick from left hand
  await s.command(9); // discard

  await s.command(7); // open pack
  await s.command(1); // take copper 1
  await s.command(1); // into left hand
  await s.command(7); // open pack
  await s.command(2); // take copper 2
  await s.command(3); // into right hand
  await s.command(4); // bump bank
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'empty');

  await s.command(6); // bump factory with silver medal
  s.expectInventory(0, 'bolt');
  s.expectInventory(1, 'empty');

  await s.command(1); // hold bolt
  await s.command(7); // in pack
  await s.command(1); // stash bolt in slot 1
  s.expectInventory(0, 'empty');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  await s.command(7); // open stash
  await s.command(3); // get copper from slot 3
  await s.command(1); // in left hand.
  await s.command(7); // open stash
  await s.command(4); // get copper from slot 4
  await s.command(3); // in right hand.
  await s.command(4); // bump bank to get silver.
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  await s.command(7); // open stash
  await s.command(6); // get copper from slot 6
  await s.command(3); // in right hand
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'copper');
  s.expectInventory(2, 'bolt');

  await s.command(4); // bump bank to exchange silver and copper for gold
  s.expectInventory(0, 'gold');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  await s.command(6); // bump factory to change gold to gear
  s.expectInventory(0, 'gear');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  await s.command(7); // open pack
  await s.command(1); // get bolt
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(b).  <- bolt (agent) over
    [ g ]  <- gear (reagent)
  `);

  await s.command(2); // construct shovel from bolt over gear
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(s).  <- shovel
    [ . ]
  `);
});

// This of course covers restoration, but is also a useful utility for ad-hoc
// test failure isolation and reproduction.
test('restore', async t => {
  const path = url.fileURLToPath(
    new URL('emojiquest/emojiquest.json', import.meta.url),
  );
  const text = await fs.readFile(path, 'utf8');
  const worldData = JSON.parse(text);

  const s = makeScaffold(t, { tilesPerFacet: 9, facetsPerFace: 9, worldData });
  s.play();

  s.expectMode('play');
});
