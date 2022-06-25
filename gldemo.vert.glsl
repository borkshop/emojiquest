#version 300 es

#define TAU 6.283185307179586

precision highp float;
precision highp int;

uniform mat4 perspective;
uniform mat4 transform;
uniform vec4 nowhere;
uniform int stride;

in float spin;
in float size;
in uint layerID;

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

  gl_Position = perspective * transform * vec4(
    loc * size + size/float(2), // x, y
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
