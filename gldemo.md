# EmojiQuest GL Tile System Design Notes

- NOTE: our current needs (for grass-vs-water) and @kris's memory from the
  lobster demo would seem to be addressed well by:
  - the "Marching Squares" style described in `gamedev.stackexchange#148460`
    saying that it works with a 16-tile set
  - the `0.5` offset remarks in `playtechs` and its notes about being "defined
    by only 4 grid locations", would imply `2^4 = 16`-arity tileset as well

- PLAN:
  - reify a procedural tile sheet system within the current demo code
    - the current data driven approach can then just be one such procedure
    - for reference, that's the one that uses a definition like:
      ```
      {glyph?: string, fill?: style, border?: {size: number, style: string}}
      ```
      to do simple 2d-constext rendering of emoji and full solid bg tiles
    - we can then implement things like procedural drawing of curved
      water-vs-land interaction or static asset loading of a predrawn tileset
    - sheets will be chiefly responsible for mapping some (maybe parametric!)
      space of tile identifiers to tuples of gl texture and layer number

  - reify a layered point rendering system
     - starting off with simple routine definition and re-use based on the
       current demo code
     - unclear yet where object boundaries will be useful here, if any at all

- TODO: fully read nvidia gpugems chapter 12,
  - especial attention to texture packing logistics and mipmap issues

# Tileset Lore

## <http://playtechs.blogspot.com/2007/04/tileset-design-tip.html>

> The terrain types are effectively defined at the centers of the tiles. This
> is not a good solution; it creates a combinatorial explosion because the
> tile's appearance is affected by nine different grid locations.

> It is much better to define terrain types at the corners of the tiles:

> Now each tile is defined by only four grid locations.

> I got a comment about how foreground tiles should be aligned relative to the
> background tiles.
> The commenter is exactly right; foreground tiles are generally centered on
> the background tiles' corners.

Aligns with @kris's memory of `0.5`-offset rendering

## <https://age-of-transcendence.com/2018/02/09/autotiling-adventures/>

- is a dead link now in 2022 ... TODO wayback machine chase it
- however found these newer entries
  - <https://byte-arcane.github.io/age-of-transcendence/2020/12/09/more-autotiles-transitions-between-floor-types/>
  - <https://byte-arcane.github.io/age-of-transcendence/2020/12/03/autotiles-instancing-and-object-clusters/>
- which had a reference to this fire resource from `gamedev.stackexchange`:
  - <https://gamedev.stackexchange.com/questions/148460/combinations-for-tiling-two-textures-together/148464>

## <http://www.cr31.co.uk/stagecast/wang/blob.html>

## <https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-12-tile-based-texture-mapping>
