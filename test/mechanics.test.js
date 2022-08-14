import test from 'ava';
import { makeMechanics } from '../mechanics.js';
import * as emojiQuestMechanics from '../emojiquest/mechanics.js';

test('precompile mechanics', t => {
  t.notThrows(() => makeMechanics(emojiQuestMechanics));
});
