#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_threshold;

out vec4 fragColor;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 color = texture(u_image, v_texCoord);
  float lum = luminance(color.rgb);
  float strength = smoothstep(u_threshold - 0.1, u_threshold + 0.1, lum);
  vec3 extracted = color.rgb * strength;

  fragColor = vec4(extracted, strength);
}


