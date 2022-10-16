/**
 * @param {string} allegedJson
 */
export const parseJson = allegedJson => {
  try {
    const value = JSON.parse(allegedJson);
    return { value };
  } catch (error) {
    return { error };
  }
};
