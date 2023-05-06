import fs from 'node:fs/promises';
import url from 'node:url';

import { validate } from '../file.js';
import * as mechanics from '../emojiquest/mechanics.js';

process.exitCode = 1;

const path = url.fileURLToPath(
  new URL('../emojiquest/emojiquest.json', import.meta.url),
);
let text = await fs.readFile(path, 'utf8');
const world = JSON.parse(text);
world.mechanics = mechanics;

const result = validate(world);
if ('errors' in result) {
  for (const error of result.errors) {
    console.log(error);
  }
} else {
  text = JSON.stringify(world);
  await fs.writeFile(path, text);
  process.exitCode = 0;
}
