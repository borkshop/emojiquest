// @ts-check

const types = [
  {
    description: 'Emoji Quest Game Save',
    accept: {
      'application/octet-stream': ['.eq'],
    }
  }
];

/**
 * @param {import('./model.js').RestoreFn} restore
 * @returns {Promise<undefined | number | Array<string>>}
 */
export const load = async restore => {
  const [handle] = await window.showOpenFilePicker({
    types,
    multiple: false,
  });
  if (handle !== undefined) {
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    return restore(data);
  }
  return;
};

/**
 * @param {import('./model.js').CaptureFn} capture
 * @param {number} agent
 */
export const save = async (capture, agent) => {
  const handle = await window.showSaveFilePicker({ types });
  const stream = await handle.createWritable();
  const data = capture(agent);
  const text = JSON.stringify(data);
  const blob = new Blob([text]);
  await stream.write(blob);
  await stream.close();
};
