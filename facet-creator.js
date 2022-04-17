// @ts-check

import {tileColor} from './brand.js';

/** @typedef {import('./animation2d.js').Coord} Coord */

const svgNS = "http://www.w3.org/2000/svg";

/**
 * @param {Object} args
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.watchTerrain
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.unwatchTerrain
 * @param {number} args.facetSize - the height and width of a facet in tiles
 * @param {number} args.tileSizePx - the height and width of a facet in pixels
 * @param {(location: number) => number} args.getTerrainFlags
 */
export function makeFacetCreator({
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  facetSize,
  tileSizePx,
}) {
  const animators = new Set();

  /**
   * @param {number} _facetNumber
   * @param {number} faceNumber
   * @param {Map<number, Coord>} tiles
   * @returns {{$facet: SVGElement, $layer: SVGElement, dispose: () => void}}
   */
  function createFacet(_facetNumber, faceNumber, tiles) {
    const backTiles = new Map();
    const frontTiles = new Map();

    const $facet = document.createElementNS(svgNS, 'svg');
    $facet.setAttributeNS(null, 'viewBox', `0 0 ${facetSize} ${facetSize}`);
    $facet.setAttributeNS(null, 'height', `${facetSize * tileSizePx}`);
    $facet.setAttributeNS(null, 'width', `${facetSize * tileSizePx}`);
    $facet.setAttributeNS(null, 'class', 'facet');

    const $back = document.createElementNS(svgNS, 'g');
    const $layer = document.createElementNS(svgNS, 'g');
    const $front = document.createElementNS(svgNS, 'g');

    for (const [location, {x, y}] of tiles.entries()) {
      const $backTile = document.createElementNS(svgNS, 'rect');
      const terrainFlags = getTerrainFlags(location);
      const color = tileColor(faceNumber, terrainFlags);
      $backTile.setAttributeNS(null, 'height', `1`);
      $backTile.setAttributeNS(null, 'width', `1`);
      $backTile.setAttributeNS(null, 'x', `${x}`);
      $backTile.setAttributeNS(null, 'y', `${y}`);
      $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      $back.appendChild($backTile);
      backTiles.set(location, $backTile);
    }

    for (const [location, {x, y}] of tiles.entries()) {
      const terrainFlags = getTerrainFlags(location);
      const color = tileColor(faceNumber, terrainFlags);
      const $frontTile = document.createElementNS(svgNS, 'rect');
      $frontTile.setAttributeNS(null, 'height', `1`);
      $frontTile.setAttributeNS(null, 'width', `1`);
      $frontTile.setAttributeNS(null, 'x', `${x}`);
      $frontTile.setAttributeNS(null, 'y', `${y}`);
      $frontTile.setAttributeNS(null, 'style', `fill: ${color}; filter: opacity(0)`);
      $front.appendChild($frontTile);
      frontTiles.set(location, $frontTile);
    }

    $facet.appendChild($back);
    $facet.appendChild($layer);
    // TODO: front tile opacity filtering does not work on Safari, ergo iOS
    // $facet.appendChild($front);

    const marked = new Set();

    /**
     * @param {number} location
     */
    const mark = location => {
      marked.add(location);
    };

    watchTerrain(tiles.keys(), mark);

    /**
     * @param {import('./animation.js').Progress} _progress
     */
    const animate = _progress => {
      for (const location of marked) {
        const $frontTile = frontTiles.get(location);
        const $backTile = backTiles.get(location);
        const terrainFlags = getTerrainFlags(location);
        const color = tileColor(faceNumber, terrainFlags);
        $frontTile.setAttributeNS(null, 'style', `fill: ${color}; filter: opacity(0)`);
        $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      }
      marked.clear();
    };

    animators.add(animate);

    const dispose = () => {
      animators.delete(animate);
      unwatchTerrain(tiles.keys(), mark);
    };

    return {$facet, $layer, dispose};
  }

  /**
   * @param {import('./animation.js').Progress} progress
   */
  const animateFacets = progress => {
    for (const animate of animators) {
      animate(progress);
    }
  };

  return {createFacet, animateFacets};
}
