/**
 * The brand module provides Emoji Quest branded color constants and
 * potentially other shared styles.
 */

// @ts-check

/**
 * brand provides branded colors for the game.
 *
 * Brand colors from https://openmoji.org/styleguide/
 */

export const lightBlue   = '#92D3F5';
export const darkBlue    = '#61B2E4';
export const lightRed    = '#EA5A47';
export const darkRed     = '#D22F27';
export const lightGreen  = '#B14CC3';
export const darkGreen   = '#5C9E31';
export const lightYellow = '#FCEA2B';
export const darkYellow  = '#F1B31C';
export const white       = '#FFFFFF';
export const lightGrey   = '#D0CFCE';
export const grey        = '#9B9B9A';
export const darkGrey    = '#3F3F3F';
export const lightPink   = '#FFA7C0';
export const darkPink    = '#E67A94';
export const lightPurple = '#B399C8';
export const darkPurple  = '#8967AA';
export const lightOrange = '#F4AA41';
export const darkOrange  = '#E27022';
export const lightBrown  = '#A57939';
export const darkBrown   = '#6A462F';

export const palette = [
  lightBlue,
  lightRed,
  lightGreen,
  lightYellow,

  darkBlue,
  darkRed,
  darkGreen,
  darkYellow,

  white,
  lightGrey,
  grey,
  darkGrey,

  lightPink,
  lightPurple,
  lightOrange,
  lightBrown,

  darkPink,
  darkPurple,
  darkOrange,
  darkBrown,
];

// Colors are arranged such that CMY are about the origin and RGB on the polar
// opposites.
// Colors on opposite faces are also opposite hues.
export const faceColors = [
  lightPurple,  // 1: M
  lightOrange,  // 2: Y
  lightBlue,    // 3: C (water is primary)
  white,        // 4: R
  lightBlue,    // 5: B (water is primary)
  darkGreen,    // 6: G
];

export const earthColors = [
  lightPurple,  // 1: M
  lightOrange,  // 2: Y
  white,        // 3: C (water is primary)
  white,        // 4: R
  lightOrange,  // 5: B (water is primary)
  darkGreen,    // 6: G
];

export const faceWaterColors = [
  darkBlue,
  darkBlue,
  lightBlue,
  lightBlue,
  darkBlue,
  darkBlue,
];

export const faceHighlightColors = [
  darkPurple,
  lightBrown,
  darkBlue,
  lightRed,
  lightBlue,
  lightBrown,
];

export const magmaColor = darkRed;

/**
 * @param {number} faceNumber
 * @param {number} terrainFlags
 */
export function tileColor(faceNumber, terrainFlags) {
  if ((terrainFlags & 0b10) !== 0) { // magma
    return magmaColor;
  } else if ((terrainFlags & 0b1) !== 0) { // water
    return faceWaterColors[faceNumber];
  } else { // earth
    return earthColors[faceNumber];
  }
}
