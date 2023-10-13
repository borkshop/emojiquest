#version 300 es

#define TAU 6.283185307179586

precision highp float;
precision highp int;

uniform ViewParams {
  // viewport defining transormf matrix over layer pixel space
  mat4 perspective;

  // nowhere is used to cull null cells (layerID=0), should be set to a
  // scissored or out of viewport position
  vec4 nowhere;
};

uniform mat4 transform;
uniform int stride;

// Layer ordianl (1-based) within the texture atlas; a 0 value means a null
// tile that will be culled (by having its position set to nowhere.
in uint layerID;

// TODO position input
in float spin;
in float size; // TODO make uniform; replace with scale factor

out float sheetLayer;
out mat3 tileTransform;

const mat3 spinOffset = mat3(
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, 1.0, 0.0),
  vec3(0.5, 0.5, 1.0)
);

void main(void) {

  if (int(layerID) == 0) {
    gl_Position = nowhere;
    return;
  }

  vec2 loc = vec2(
    float(gl_VertexID % stride),
    float(gl_VertexID / stride)
  );
  loc += 0.5;

  gl_Position = perspective * transform * vec4(
    loc * size, // x, y
    0.0, // z
    1.0  // w
  );

  float theta = spin * TAU;
  float cost = cos(theta);
  float sint = sin(theta);

  tileTransform = spinOffset * mat3(
    vec3(cost, -sint, 0.0),
    vec3(sint, cost, 0.0),
    vec3(0.0, 0.0, 1.0)
  ) * inverse(spinOffset);

  gl_PointSize = size;

  sheetLayer = float(layerID) - 1.0;
}
