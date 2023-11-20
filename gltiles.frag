#version 300 es

precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray sheet;

uniform AnimParams {
  bool anim_enabled;

  float anim_time;
};

in vec2 fragAnim; // x=enabled, y=progress

in vec2 sheetLayer;

in mat3 tileTransform;

out lowp vec4 color;

void main(void) {
  mediump vec2 tileAt = (tileTransform * vec3(gl_PointCoord, 1)).xy;

  color = texture(sheet, vec3(tileAt, sheetLayer[0]));
  if (anim_enabled && fragAnim.x > 0.0) {
    color = mix(color, texture(sheet, vec3(tileAt, sheetLayer[1])), fragAnim.y);
  }
}
