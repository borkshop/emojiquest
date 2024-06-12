#version 300 es

precision highp float;
precision highp int;

in lowp vec4 fragColor;

out lowp vec4 color;

void main(void) {
  color = fragColor;
}
