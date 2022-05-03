// @ts-check

/** @type {Record<string, number>} */
const commandForKey = {
  ArrowUp: 8,
  ArrowLeft: 4,
  ArrowRight: 6,
  ArrowDown: 2,
  ' ': 5,

  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,

  h: 4,
  j: 2,
  k: 8,
  l: 6,

  m: 1,
  ',': 2,
  '.': 3,

  u: 7,
  i: 8,
  o: 9,

  d: 3,
  f: 1,
};

/**
 * @param {Window} window
 * @param {Object} driver
 * @param {(command: number) => void} driver.up
 * @param {(command: number) => void} driver.down
 */
export const makeCommandDispatcher = (window, driver) => {
  const commandHolders = new Array(10).fill(undefined).map(() => new Set());

  /**
   * @param {string} holder
   * @param {number} command
   */
  const down = (holder, command) => {
    const holders = commandHolders[command];
    if (holders.size === 0) {
      driver.down(command);
    }
    holders.add(holder);
  };

  /**
   * @param {string} holder
   * @param {number} command
   */
  const up = (holder, command) => {
    const holders = commandHolders[command];
    holders.delete(holder);
    if (holders.size === 0) {
      driver.up(command);
    }
  };

  const cancel = () => {
    for (const [command, holders] of commandHolders.entries()) {
      if (holders.size) {
        holders.clear();
        driver.up(command);
      }
    }
  };

  // TODO the keydown and keyup handlers below could be readily externalized
  // and be on equal footing with the controller key dispatchers, making the
  // command dispatcher purely a mux.

  window.addEventListener('keydown', event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = commandForKey[key];
    if (command === undefined) return;
    down(key, command);
  });

  window.addEventListener('keyup', event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = commandForKey[key];
    if (command === undefined) return;
    up(key, command);
  });

  window.addEventListener('blur', () => {
    cancel();
  });

  return { down, up, cancel };
};

/**
 * @typedef {ReturnType<makeCommandDispatcher>} CommandDispatcher
 */
