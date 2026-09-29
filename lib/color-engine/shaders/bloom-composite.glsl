#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_originalImage;
uniform sampler2D u_bloomImage;
uniform float u_intensity;
uniform float u_colorTemperature; // -1 (cool/blue) to 1 (warm/orange)

out vec4 fragColor;

// Apply color temperature shift to bloom
// Warm shifts toward orange/yellow, cool shifts toward blue
vec3 applyColorTemperature(vec3 color, float temperature) {
  if (abs(temperature) < 0.001) {
    return color;
  }
  
  // Temperature coefficients based on Planckian locus approximation
  vec3 warmShift = vec3(1.0, 0.85, 0.6);   // Warm: boost red, reduce blue
  vec3 coolShift = vec3(0.7, 0.85, 1.0);   // Cool: boost blue, reduce red
  
  vec3 tint = mix(vec3(1.0), temperature > 0.0 ? warmShift : coolShift, abs(temperature));
  
  return color * tint;
}

void main() {
  vec4 original = texture(u_originalImage, v_texCoord);
  vec3 bloom = texture(u_bloomImage, v_texCoord).rgb;
  
  // Apply color temperature to bloom only (not original image)
  vec3 tintedBloom = applyColorTemperature(bloom, u_colorTemperature);
  
  // Additive blend with intensity control
  vec3 combined = original.rgb + tintedBloom * clamp(u_intensity, 0.0, 1.0);
  
  // Soft clamp to prevent harsh clipping
  combined = min(combined, vec3(1.0));

  fragColor = vec4(combined, original.a);
}


