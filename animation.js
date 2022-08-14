// @ts-check

/**
 * @returns {Promise<number>} - resolves to the current high-res time at the
 * start of the next browser animation frame
 */
export const nextFrame = () => {
  return new Promise(resolve => requestAnimationFrame(resolve));
};

/**
 * @returns {AsyncGenerator<number>} - a stream of elapsed time deltas between
 * animation frames, starting with 0 on the first frame
 */
export async function* frameDeltas() {
  for (
    let t1 = await nextFrame(), t2 = t1;
    ;
    /* 🐙 🦑 👾 */ t1 = t2, t2 = await nextFrame()
  )
    yield t2 - t1;
}
