// @ts-check

export const agentTypes = [
  { name: 'player', tile: 'happy' },
  { name: 'pineTree' },
  { name: 'appleTree' },
  { name: 'axe' },
];

export const itemTypes = [
  { name: 'empty' },
  { name: 'apple' },
  { name: 'axe' },
  { name: 'pineLumber', tile: 'pineTree' },
];

const tileTypes = [
  { name: 'happy', text: '🙂' },
  { name: 'backpack', text: '🎒    ' },
  { name: 'trash', text: '🗑    ' },
  { name: 'shield', text: '🛡    ' },
  { name: 'pineTree', text: '🌲' },
  { name: 'appleTree', text: '🌳' },
  { name: 'axe', text: '🪓   ' },
  { name: 'apple', text: '🍎 ' },
  { name: 'north', text: '👆  ' },
  { name: 'south', text: '👇  ' },
  { name: 'west', text: '👈 ' },
  { name: 'east', text: '👉 ' },
  { name: 'left', text: '✋ ' },
  { name: 'swap', text: '🤝    ' },
  { name: 'right', text: '🤚 ' },
  { name: 'watch', text: '⏱ ' },
  { name: 'health', text: '❤️ ' },
  { name: 'stamina', text: '💛 ' },
  { name: 'healthSlot', text: '🖤 ' },
  { name: 'staminaSlot', text: '🖤 ' },
];

export const tileTypesByName = Object.fromEntries(tileTypes.map((type, index) => [type.name, index]));
export const agentTypesByName = Object.fromEntries(agentTypes.map(({ name }, i) => [name, i]));
export const itemTypesByName = Object.fromEntries(itemTypes.map(({ name }, i) => [name, i]));

export const defaultTileTypeForAgentType = agentTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const tileTypeForItemType = itemTypes.map(({ name, tile }) => tileTypesByName[tile || name]);
export const viewText = tileTypes.map(type => type.text);
