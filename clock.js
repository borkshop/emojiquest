export const makeClock = () => {
  const clocks = new Set();

  const tick = () => {
    for (const clock of clocks) {
      clock.tick();
    }
  };

  const tock = () => {
    for (const clock of clocks) {
      clock.tock();
    }
  };

  /** @type {import('./progress.js').AnimateFn}  */
  const animate = progress => {
    for (const clock of clocks) {
      clock.animate(progress);
    }
  };

  /** @param {import('./types.js').Clock} clock */
  const add = clock => clocks.add(clock);

  /** @param {import('./types.js').Clock} clock */
  const remove = clock => clocks.delete(clock);

  return {
    add,
    remove,
    tick,
    tock,
    animate,
  };
};
