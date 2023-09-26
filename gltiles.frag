#version 300 es

precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray sheet;

in float sheetLayer;
in mat3 tileTransform;

out lowp vec4 color;

void main(void) {
  mediump vec2 tileAt = (tileTransform * vec3(gl_PointCoord, 1)).xy;

  color = texture(sheet, vec3(tileAt, sheetLayer));
}
