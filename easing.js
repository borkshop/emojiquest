// @ts-check

// https://gist.github.com/gre/1650294

/**
 * no easing, no acceleration
 * @param {number} t
 * @returns {number}
 */
export const linear = t => t;
/**
 * accelerating from zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeInQuad = t => t*t;
/**
 * decelerating to zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeOutQuad = t => t*(2-t);
/**
 * acceleration until halfway, then deceleration
 * @param {number} t
 * @returns {number}
 */
export const easeInOutQuad = t => t<.5 ? 2*t*t : -1+(4-2*t)*t;
/**
 * accelerating from zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeInCubic = t => t*t*t;
/**
 * decelerating to zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeOutCubic = t => (--t)*t*t+1;
/**
 * acceleration until halfway, then deceleration
 * @param {number} t
 * @returns {number}
 */
export const easeInOutCubic = t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
/**
 * accelerating from zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeInQuart = t => t*t*t*t;
/**
 * decelerating to zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeOutQuart = t => 1-(--t)*t*t*t;
/**
 * acceleration until halfway, then deceleration
 * @param {number} t
 * @returns {number}
 */
export const easeInOutQuart = t => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t;
/**
 * accelerating from zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeInQuint = t => t*t*t*t*t;
/**
 * decelerating to zero velocity
 * @param {number} t
 * @returns {number}
 */
export const easeOutQuint = t => 1+(--t)*t*t*t*t;
/**
 * acceleration until halfway, then deceleration
 * @param {number} t
 * @returns {number}
 */
export const easeInOutQuint = t => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t
