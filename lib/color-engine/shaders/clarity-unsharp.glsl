#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_originalImage;
uniform sampler2D u_blurredImage;
uniform float u_intensity;
uniform float u_threshold;

out vec4 fragColor;

void main() {
  vec4 original = texture(u_originalImage, v_texCoord);
  vec4 blurred = texture(u_blurredImage, v_texCoord);
  
  // Calculate the difference (high-frequency detail)
  vec3 diff = original.rgb - blurred.rgb;
  
  // Calculate edge strength (magnitude of difference)
  float edgeStrength = length(diff);
  
  // Soft threshold using smoothstep for gradual falloff
  // Edges below threshold are attenuated, above threshold are preserved
  float edgeMask = smoothstep(u_threshold * 0.5, u_threshold, edgeStrength);
  
  // Apply sharpening: original + (original - blurred) * intensity * mask
  // This enhances edges while preserving smooth areas
  vec3 sharpened = original.rgb + diff * u_intensity * edgeMask;
  
  // Clamp to valid color range
  sharpened = clamp(sharpened, 0.0, 1.0);
  
  fragColor = vec4(sharpened, original.a);
}
