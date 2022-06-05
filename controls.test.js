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
  t.is(s.health, 3);
  s.command(9); // eat the apple (move to mouth)
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  t.is(s.health, 4);
});

test('the pear tree', t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ P
    . . .
  `);
  s.play();

  s.expectScene(`
    . . .
    . @ A  <- pear tree appears as apple tree tile
    . . .
  `);

  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  s.command(6); // bump tree to the east
  s.expectControls(`
    . ^ s
    < z >
    p v ]
  `);
  s.command(1); // select pear from left hand
  s.expectControls(`
    b . m  <- backpack and mouth show
    .(p).  <- reticle around pear
    [ . ]  <- empty hands, no D-pad
  `);
  t.is(s.stamina, 3);
  s.command(9); // eat the pear (move to mouth)
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
  t.is(s.stamina, 4);
});

test('trash inventory', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'silver');
  s.play();
  s.expectControls(`
    . ^ s <- nothing in the pack
    < z >
    s v ] <- have silver medal
  `);

  s.command(1); // select medal
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(s).  <- reticle around apple
    [ . ]  <- empty hands, no D-pad
  `);

  s.command(9); // throw medal away
  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);
});

test('chop down a tree', t => {
  const s = makeScaffold(t);
  s.scene(`
    . . .
    . @ A
    . . .
  `);
  s.inventory(0, 'axe');
  s.play();

  s.command(6); // chop down tree
  s.expectScene(`
    . . .
    . @ .  <- no tree
    . . .
  `);
  s.expectInventory(0, 'axe');
  s.expectInventory(1, 'hardwood');
});

test('craft softwood over axe', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'axe');
  s.inventory(1, 'softwood');
  s.play();
  s.expectControls(`
    . ^ s <- nothing in the pack
    < z >
    a v l <- axe and softwood (as lumber tile)
  `);

  s.command(3); // select softwood
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(l).  <- lumber (agent) over
    [ a ]  <- axe (reagent)
  `);

  s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(n).  <- knitting needles (product) over
    [ a ]  <- axe (byproduct preserved reagent)
  `);
  s.expectInventory(0, 'knittingNeedles');
  s.expectInventory(1, 'axe');
});

test('craft axe from knife and hammer', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'knife');
  s.inventory(1, 'hammer');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    k v h
  `);

  s.command(1); // select knife
  s.expectControls(`
    b . t
    .(k).  <- knife (agent) over
    [ h ]  <- hammer (reagent)
  `);

  s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(a).  <- axe
    [ . ]
  `);
  s.expectInventory(0, 'axe');
  s.expectInventory(1, 'empty');
});

test('craft axe over softwood', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'axe');
  s.inventory(1, 'softwood');
  s.play();
  s.expectControls(`
    . ^ s <- nothing in the pack
    < z >
    a v l <- axe and softwood (as lumber tile)
  `);

  s.command(1); // select axe
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(a).  <- axe (agent) over
    [ l ]  <- softwood with lumber tile (reagent)
  `);

  s.command(2); // craft
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(n).  <- knitting needles (product) over
    [ a ]  <- axe (byproduct preserved agent)
  `);
  s.expectInventory(0, 'knittingNeedles');
  s.expectInventory(1, 'axe');
});

test('craft canoe', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'spoon');
  s.inventory(1, 'softwood');
  s.play();

  s.command(1); // select spoon
  s.command(2); // apply to softwood
  s.expectInventory(0, 'canoe');
  s.expectInventory(1, 'spoon');
  s.expectControls(`
    b . a  <- backpack and effect chooser (arm)
    .(c).  <- canoe
    [ s ]  <- spoon
  `);
});

test('craft apple over apple', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(1, 'apple');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    a v a
  `);

  s.command(3); // select apple
  s.expectControls(`
    b . m
    .(a).  <- apple (agent) over
    [ a ]  <- apple (reagent)
  `);

  s.command(2); // craft
  s.expectControls(`
    b . m
    .(p).  <- pear
    [ . ]
  `);
  s.expectInventory(0, 'pear');
  s.expectInventory(1, 'empty');
});

test('craft pineapple over pineapple fails', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'pineApple');
  s.inventory(1, 'pineApple');
  s.play();
  s.expectControls(`
    . ^ s
    < z >
    p v p
  `);

  s.command(3); // select pineApple
  s.expectControls(`
    b . m
    .(p).  <- pineApple (agent) over
    [ p ]  <- pineApple (reagent)
  `);

  s.command(2); // craft
  // CRAFT FAILS
  s.expectControls(`
    b . m
    .(p).  <- pineApple
    [ p ]  <- pineApple
  `);
  s.expectInventory(0, 'pineApple');
  s.expectInventory(1, 'pineApple');
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

test('juggling clockwise', t => {
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

test('hot hands', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(1, 'apple');
  s.play();

  s.expectControls(`
    . ^ s
    < z >
    [ v a  <- apple in right hand
  `);

  s.command(3); // select apple from right hand
  s.expectControls(`
    b . m
    .(a).
    [ . ]
  `);

  s.command(1); // move apple to left hand
  s.expectControls(`
    . ^ s
    < z >
    a v ]  <- apple in left hand
  `);

  // a pineapple mysteriously appears in other hand
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ s
    < z >
    a v p  <-
  `);

  s.command(1); // select apple from left hand
  s.expectControls(`
    b . m
    .(a).
    [ p ]
  `);

  s.command(1); // put apple back in the left
  s.expectControls(`
    . ^ s
    < z >
    a v p  <-
  `);

  s.command(1); // select apple from left hand, again
  s.expectControls(`
    b . m
    .(a).
    [ p ]
  `);

  s.command(3); // switch apple to right hand, pineapple to left
  s.expectControls(`
    . ^ s
    < z >
    p v a  <-
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

test('from pack with empty hands', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(2, 'apple');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    [ v ]
  `);

  s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);

  s.command(1); // choose apple
  s.expectControls(`
    b . m  <- mouth, backpack is empty, but a valid stash target
    .(a).
    [ . ]
  `);

  s.command(9); // eat the apple
  s.expectControls(`
    . ^ s  <- pack is empty again
    < z >
    [ v ]  <- nothing in hand
  `);
});

test('from pack with empty hands, selecting empty pack position is no-op', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(2, 'apple');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    [ v ]
  `);

  s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);

  s.expectMode('pack');
  s.command(2); // no-op for empty slot if no item in hand
  s.expectControls(`
    7 8 9
    4 . 6
    a 2 3
  `);
});

test('to pack mode with an empty right hand', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(2, 'bolt');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    a v ]
  `);

  s.command(7); // open the backpack
  // with both hands full, the controls arbitrarily
  // select to promote the left hand to the center
  s.expectControls(`
    7 8 9
    4 . 6  <- empty
    b 2 3  <- bolt
  `);

  s.command(1); // select bolt
  s.expectControls(`
    b . t  <- pack and trash are valid targets
    .(b).  <- bolt held
    [ a ]  <- apple still here
  `);
});

test('to pack mode with full hands', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'apple');
  s.inventory(1, 'pineApple');
  s.inventory(2, 'bolt');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    a v p
  `);

  s.command(7); // open the backpack
  // with both hands full, the controls arbitrarily
  // select to promote the left hand to the center
  s.expectControls(`
    7 8 9
    4 a 6  <- apple
    b 2 3  <- bolt
  `);
});

test('to and from pack with full hands, left bias', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);

  // manus et malum
  s.inventory(0, 'apple');
  s.expectControls(`
    . ^ s
    < z >
    a v ]
  `);

  // immaculate reception
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ s
    < z >
    a v p
  `);

  s.command(1); // take apple from left hand
  s.expectControls(`
    b . m  <- backpack shows
    .(a).  <- reticle around apple
    [ p ]  <- empty hands, pineapple in limbo
  `);

  s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 a 6
    1 2 3
  `);

  s.command(5); // close pack
  s.expectControls(`
    b . m
    .(a).
    [ p ]  <- pineapple in limbo, but originally from right
  `);

  s.command(7); // reopen pack
  s.expectControls(`
    7 8 9
    4 a 6
    1 2 3
  `);

  s.command(7); // stow in slot 7
  s.expectControls(`
    b ^ s
    < z >
    [ v p  <- pineapple returns to right hand
  `);
});

test('fail to open empty pack', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.command(7);
  s.expectMode('play');
});

test('to and from pack with full hands, right bias', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.play();

  s.expectControls(`
    . ^ s
    < z >
    [ v ]
  `);

  // manus et malum
  s.inventory(0, 'apple');
  s.expectControls(`
    . ^ s
    < z >
    a v ]
  `);

  // immaculate reception
  s.inventory(1, 'pineApple');
  s.expectControls(`
    . ^ s
    < z >
    a v p
  `);

  s.command(3); // take pineapple from right hand
  s.expectControls(`
    b . m  <- backpack shows
    .(p).  <- reticle around pineapple
    [ a ]  <- empty hands, apple in limbo
  `);

  s.command(7); // open pack
  s.expectControls(`
    7 8 9
    4 p 6
    1 2 3
  `);

  s.command(5); // close pack
  s.expectControls(`
    b . m  <- backpack shows
    .(p).  <- reticle around pineapple
    [ a ]  <- empty hands, apple in limbo
  `);

  s.command(7); // reopen pack
  s.expectControls(`
    7 8 9
    4 p 6
    1 2 3
  `);

  s.command(9); // stow in slot 9
  s.expectControls(`
    b ^ s
    < z >
    a v ]  <- apple returns to left hand
  `);
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

test('start in edit mode', t => {
  const s = makeScaffold(t);
  s.play();

  s.expectMode('edit');
  s.expectScene(`
   (.). .
    . . .
    . . .
  `);
  s.command(6); // go east
  s.expectScene(`
    .(.).
    . . .
    . . .
  `);
  s.command(2); // go south
  s.expectScene(`
    . . .
    .(.).
    . . .
  `);
  s.command(5); // enter agent chooser
  s.expectMode('chooseAgent');
  s.command(2); // next entity
  s.command(5); // choose player
  s.expectMode('edit');
  s.command(1); // draw player
  // TODO fix
  // t.log(s.drawScene());
  // s.expectScene(`
  //   . . .
  //   .(@).
  //   . . .
  // `);
  s.command(0); // menu
  s.command(2); // down (loop up to play)
  s.command(0); // select play
  s.expectMode('play');
  s.expectScene(`
    . . .
    . @ .
    . . .
  `);
});

test('medal shop', t => {
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

    s.command(2); // get copper
    s.expectMode('play');
    s.expectInventory(1, 'copper');

    s.command(3); // select copper
    s.expectMode('item');
    s.command(7);
    s.expectMode('pack');
    s.command(slot); // store
  }

  s.expectMode('play');
  s.command(7); // open pack
  s.expectMode('pack');
  s.expectControls(`
    c c c
    c . c
    c c c
  `);

  s.command(5); // dismiss pack
  s.command(1); // hold pick from left hand
  s.command(9); // discard

  s.command(7); // open pack
  s.command(1); // take copper 1
  s.command(1); // into left hand
  s.command(7); // open pack
  s.command(2); // take copper 2
  s.command(3); // into right hand
  s.command(4); // bump bank
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'empty');

  s.command(6); // bump factory with silver medal
  s.expectInventory(0, 'bolt');
  s.expectInventory(1, 'empty');

  s.command(1); // hold bolt
  s.command(7); // in pack
  s.command(1); // stash bolt in slot 1
  s.expectInventory(0, 'empty');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  s.command(7); // open stash
  s.command(3); // get copper from slot 3
  s.command(1); // in left hand.
  s.command(7); // open stash
  s.command(4); // get copper from slot 4
  s.command(3); // in right hand.
  s.command(4); // bump bank to get silver.
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  s.command(7); // open stash
  s.command(6); // get copper from slot 6
  s.command(3); // in right hand
  s.expectInventory(0, 'silver');
  s.expectInventory(1, 'copper');
  s.expectInventory(2, 'bolt');

  s.command(4); // bump bank to exchange silver and copper for gold
  s.expectInventory(0, 'gold');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  s.command(6); // bump factory to change gold to gear
  s.expectInventory(0, 'gear');
  s.expectInventory(1, 'empty');
  s.expectInventory(2, 'bolt');

  s.command(7); // open pack
  s.command(1); // get bolt
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(b).  <- bolt (agent) over
    [ g ]  <- gear (reagent)
  `);

  s.command(2); // construct shovel from bolt over gear
  s.expectControls(`
    b . t  <- backpack and trash show (not mouth, not comestible)
    .(s).  <- shovel
    [ . ]
  `);
});

test('choice of effect', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'coat');
  s.play();

  s.expectControls(`
    . ^ s
    < z >
    c v ]
  `);

  s.command(1); // get coat
  s.expectControls(`
    b . a  <- backpack appears, since it can be stowed,
    .(c).  <- arm appears since it can be equipped
    [ . ]
  `);

  s.command(9); // don coat
  s.expectControls(`
    . ^ c
    < z >
    [ v ]
  `);

  s.command(9); // open effect chooser
  s.expectControls(`
    7 8 9
    4 5 6
    c 2 3
  `);

  s.command(1); // choose coat
  s.expectControls(`
    . ^ c
    < z >
    [ v ]
  `);
});

test('choice of effect with non-empty pack', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(0, 'coat');
  s.inventory(2, 'pick');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    c v ]
  `);

  s.command(1); // get coat
  s.expectControls(`
    b . a  <- backpack appears, since it can be stowed,
    .(c).  <- arm appears since it can be equipped
    [ . ]
  `);

  s.command(9); // don coat
  s.expectControls(`
    b ^ c
    < z >
    [ v ]
  `);

  s.command(9); // open effect chooser
  s.expectControls(`
    7 8 9
    4 5 6
    c 2 3
  `);

  s.command(1); // choose coat
  s.expectControls(`
    b ^ c
    < z >
    [ v ]
  `);
});

test('exit play mode with a non-empty pack', t => {
  const s = makeScaffold(t);
  s.scene('@');
  s.inventory(2, 'apple');
  s.play();

  s.expectControls(`
    b ^ s
    < z >
    [ v ]
  `);

  s.command(0); // open menu
  s.expectMode('menu');
  s.expectControls(`
    . ^ .
    . . .
    . v .
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
