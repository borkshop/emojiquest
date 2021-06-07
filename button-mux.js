// @ts-check

/**
 * @callback Command
 * @param {number} command
 */

/**
 * @typedef {Object} Observer
 * @prop {Command} up
 * @prop {Command} down
 */

export function makeButtonMux() {
  const observers = new Map();

  /**
   * @param {number} command
   */
  function up(command) {
    for (const {up} of observers.values()) {
      up(command);
    }
  }

  /**
   * @param {number} command
   */
  function down(command) {
    for (const {down} of observers.values()) {
      down(command);
    }
  }

  /**
   * @param {Observer} observer
   */
  function observe(observer) {
    observers.set(cancel, observer);
    function cancel() {
      observers.delete(cancel);
    }
  }

  return {up, down, observe};
}
