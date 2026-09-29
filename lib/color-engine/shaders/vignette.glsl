#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_radius;
uniform float u_smoothness;

out vec4 fragColor;

// Based on https://github.com/TyLindberg/glsl-vignette/blob/master/simple.glsl
float vignette(vec2 uv, float radius, float smoothness) {
  float diff = radius - distance(uv, vec2(0.5));
  return smoothstep(-smoothness, smoothness, diff);
}

void main() {
  vec4 texel = texture(u_image, v_texCoord);
  float v = vignette(v_texCoord, u_radius, u_smoothness);
  fragColor = texel * v;
}
