#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_direction; // (1.0, 0.0) for horizontal, (0.0, 1.0) for vertical
uniform float u_radius;

out vec4 fragColor;

// 9-tap Gaussian weights (sigma ~= 2.0)
// These weights are pre-normalized to sum to 1.0
const float weights[5] = float[5](
  0.227027027,  // center
  0.1945945946, // offset 1
  0.1216216216, // offset 2
  0.0540540541, // offset 3
  0.0162162162  // offset 4
);

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 blurDirection = u_direction * texelSize * u_radius;
  
  // Sample center pixel
  vec4 result = texture(u_image, v_texCoord) * weights[0];
  
  // Sample in both directions along the blur axis
  for (int i = 1; i < 5; i++) {
    vec2 offset = blurDirection * float(i);
    result += texture(u_image, v_texCoord + offset) * weights[i];
    result += texture(u_image, v_texCoord - offset) * weights[i];
  }
  
  fragColor = result;
}
