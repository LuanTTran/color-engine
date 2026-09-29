#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_redOffset;
uniform float u_blueOffset;

out vec4 fragColor;

void main() {
  // Calculate distance from center (0.5, 0.5) for edge-based falloff
  float d = length(v_texCoord - 0.5);
  
  // Scale factor for the offset (0.02 provides subtle but visible effect)
  float scale = 0.02;
  
  // Calculate offset direction from center
  vec2 dir = normalize(v_texCoord - 0.5 + 0.0001); // Small epsilon to avoid division by zero
  
  // Apply edge-based chromatic aberration
  // Red channel shifts outward, blue channel shifts inward (or vice versa based on offset sign)
  vec2 redUV = v_texCoord - dir * d * scale * u_redOffset;
  vec2 blueUV = v_texCoord + dir * d * scale * u_blueOffset;
  
  // Sample each channel with its offset
  float r = texture(u_image, redUV).r;
  float g = texture(u_image, v_texCoord).g;
  float b = texture(u_image, blueUV).b;
  float a = texture(u_image, v_texCoord).a;
  
  fragColor = vec4(r, g, b, a);
}
