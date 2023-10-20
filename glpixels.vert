#version 300 es

#define TAU 6.283185307179586

precision highp float;
precision highp int;

uniform ViewParams {
  // viewport defining transormf matrix over layer pixel space
  mat4 perspective;
};

uniform LayerParams {
  // defines layer origin and potentially transforms a layer relatively to
  // other layers (scale, rotate, skew, etc)
  mat4 transform;

  // pixel size of each tile in this layer
  float cellSize;

  int stride;
};

in lowp vec4 vertColor;

out lowp vec4 fragColor;

void main(void) {
  vec2 loc;
  if (stride > 0) {
    loc = vec2(
      float(gl_VertexID % stride),
      float(gl_VertexID / stride)
    );
  }
  loc += 0.5;

  gl_PointSize = cellSize;

  gl_Position = perspective * transform * vec4(
    loc * cellSize, // x, y
    0.0, // z
    1.0  // w
  );

  fragColor = vertColor;
}
