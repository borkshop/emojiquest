// @ts-check

const viewTypes = [
  { name: 'agent', text: '🙂' },
  { name: 'tree', text: '🌲' },
  { name: 'north', text: '👆  ' },
  { name: 'south', text: '👇  ' },
  { name: 'west', text: '👈 ' },
  { name: 'east', text: '👉 ' },
  { name: 'left', text: '✋ ' },
  { name: 'right', text: '🤚 ' },
  { name: 'watch', text: '⏱ ' },
  { name: 'health', text: '❤️ ' },
  { name: 'stamina', text: '💛 ' },
  { name: 'healthSlot', text: '🖤 ' },
  { name: 'staminaSlot', text: '🖤 ' },
];

export const viewTypesByName = Object.fromEntries(viewTypes.map((type, index) => [type.name, index]));
export const viewText = viewTypes.map(type => type.text);
