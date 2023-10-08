#version 300 es

#define TAU 6.283185307179586

precision highp float;
precision highp int;

uniform ViewParams {
  // viewport defining transormf matrix over layer pixel space
  mat4 perspective;

  // default pixel size for normal layers
  float viewCellSize;

  // nowhere is used to cull null cells (layerID=0), should be set to a
  // scissored or out of viewport position
  vec4 nowhere;
};

uniform LayerParams {
  // defines layer origin and potentially transforms a layer relatively to
  // other layers (scale, rotate, skew, etc)
  mat4 transform;

  // pixel size of each tile in this layer
  float cellSize;

  // Implicit positioning mode is enabled if stride > 0, where tiles are laid
  // out as a dense grid indexed by gl_VertexID in row-major order starting at
  // layer origin (defined by transform) and progressing in stride-sized rows.
  // Any offset attribute value is added to this value.
  //
  // Otherwise absolute positioning is used, relying on offset to position each
  // tile (still relative to transform origin of course).
  int stride;
};

// Layer ordianl (1-based) within the texture atlas; a 0 value means a null
// tile that will be culled (by having its position set to nowhere.
in uint layerID;

// Tile dosition data: xy = offset, z = spin, w = scale
in vec4 pos;

out float sheetLayer;
out mat3 tileTransform;

const mat3 spinOffset = mat3(
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, 1.0, 0.0),
  vec3(0.5, 0.5, 1.0)
);

void main(void) {
  float size = cellSize == 0.0 ? viewCellSize : cellSize;
  mat4 xform = transform;
  xform[0].x *= size;
  xform[1].y *= size;
  xform[3].xy *= size;

  vec2 offset = pos.xy;
  float spin = pos.z;
  float scale = pos.w;

  if (scale <= 0.0 || int(layerID) == 0) {
    gl_Position = nowhere;
    return;
  }

  vec2 loc;
  if (stride > 0) {
    loc = vec2(
      float(gl_VertexID % stride),
      float(gl_VertexID / stride)
    );
  }
  loc += 0.5;
  loc += offset;

  gl_Position = perspective * xform * vec4(loc, 0.0, 1.0);

  float theta = spin * TAU;
  float cost = cos(theta);
  float sint = sin(theta);

  tileTransform = spinOffset * mat3(
    vec3(cost, -sint, 0.0),
    vec3(sint, cost, 0.0),
    vec3(0.0, 0.0, 1.0)
  ) * inverse(spinOffset);

  gl_PointSize = size * scale;

  sheetLayer = float(layerID) - 1.0;
}
