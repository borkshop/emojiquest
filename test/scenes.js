// Run with yarn test scenes.js

import test from 'ava';
import { makeScaffold } from './test-scaffold.js';

test('metal shop scene', async t => {
  const s = makeScaffold(t, {
    legend: {
      M: 'mountain',
      R: 'boulder',
      B: 'bank',
      F: 'forge',
    },
  });
  s.scene(`
    B . F
    . @ .
    R M .
  `);
  await s.save('metalshop.json', import.meta.url);
});
