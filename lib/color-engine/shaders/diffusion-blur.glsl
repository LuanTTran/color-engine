#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_blurDirection;
uniform float u_blurRadius;
uniform vec2 u_resolution;

out vec4 fragColor;

const float KERNEL_WEIGHTS[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec3 color = texture(u_image, v_texCoord).rgb * KERNEL_WEIGHTS[0];

  for (int i = 1; i < 5; i++) {
    vec2 offset = float(i) * u_blurRadius * texel * u_blurDirection;
    color += texture(u_image, v_texCoord + offset).rgb * KERNEL_WEIGHTS[i];
    color += texture(u_image, v_texCoord - offset).rgb * KERNEL_WEIGHTS[i];
  }

  fragColor = vec4(color, texture(u_image, v_texCoord).a);
}


