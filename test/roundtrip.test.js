import fs from 'node:fs/promises';
import url from 'node:url';
import { WholeWorldDescription } from '../schema.js';
import { makeEnricher } from '../lib/schema-enricher.js';
import { makeDiluter } from '../lib/schema-diluter.js';
import { makeValidator } from '../lib/schema-validator.js';

import test from 'ava';

test('round trip emojiquest data file format', async t => {
  const path = url.fileURLToPath(
    new URL('../emojiquest/emojiquest.json', import.meta.url),
  );
  let text = await fs.readFile(path, 'utf8');

  const validate = makeValidator(WholeWorldDescription);
  const enrich = makeEnricher(WholeWorldDescription);
  const dilute = makeDiluter(WholeWorldDescription);

  const allegedWholeWorldDescription = JSON.parse(text);
  /** @type {Array<string>} */
  const errors = [];
  validate(allegedWholeWorldDescription, errors);
  t.deepEqual([], errors);

  const wholeWorldDescription = enrich(allegedWholeWorldDescription);
  const recreatedWholeWorldDescription = dilute(wholeWorldDescription);

  t.deepEqual(allegedWholeWorldDescription, recreatedWholeWorldDescription);
});
