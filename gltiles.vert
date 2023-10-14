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

uniform AnimParams {
  bool anim_enabled;

  float anim_time;
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
in uvec2 layerID;

in vec3 anim; // x=start_time, y=duration, z=mode

// Tile position data: xy = offset, z = spin, w = scale
in vec4 pos;
in vec4 posTo;

out vec2 fragAnim; // x=enabled, y=progress

out vec2 sheetLayer;

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

  vec4 posAt = pos;

  if (anim_enabled && anim.y > 0.0) {
    float progress = (anim_time - anim.x) / anim.y;
    if (progress > 0.0) {
      switch (int(anim.z)) {

        case 1: // loop
          progress = fract(progress);
          break;

        case 2: // loop-back
          if (int(floor(progress)) % 2 == 1) {
            progress = 1.0 - fract(progress);
          } else {
            progress = fract(progress);
          }
          break;

        default:
          progress = max(0.0, min(1.0, progress));
      }
      posAt = mix(posAt, posTo, progress);
      fragAnim = vec2(1.0, progress);
    }
  }

  vec2 offset = posAt.xy;
  float spin = posAt.z;
  float scale = posAt.w;

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

  sheetLayer = vec2(layerID) - 1.0;
}
