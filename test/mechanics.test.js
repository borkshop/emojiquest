import test from 'ava';
import { makeMechanics } from '../mechanics.js';
import * as data from '../data.js';

test('precompile mechanics', t => {
  t.notThrows(() => makeMechanics(data));
});
