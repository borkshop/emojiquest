// @ts-check

/**
 * @param {Window} window
 * @param {Object} driver
 * @param {(command: number) => void} driver.up
 * @param {(command: number) => void} driver.down
 * @param {(key: string) => number | undefined} driver.commandForKey
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

  // Account for how the key to command mapping changes due to mode switching.
  // Each keyup will cancel whatever command it innitiated.
  const commandForKey = new Map();

  window.addEventListener('keydown', event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = driver.commandForKey(key);
    if (command === undefined) return;
    event.stopPropagation();
    commandForKey.set(key, command);
    down(key, command);
  });

  window.addEventListener('keyup', event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = commandForKey.get(key);
    if (command === undefined) return;
    event.stopPropagation();
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
