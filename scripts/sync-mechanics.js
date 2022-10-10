import fs from 'node:fs/promises';
import url from 'node:url';

import * as mechanics from '../emojiquest/mechanics.js';

const path = url.fileURLToPath(
  new URL('../emojiquest/emojiquest.json', import.meta.url),
);
let text = await fs.readFile(path, 'utf8');
const world = JSON.parse(text);
world.mechanics = mechanics;
text = JSON.stringify(world);
await fs.writeFile(path, text);
