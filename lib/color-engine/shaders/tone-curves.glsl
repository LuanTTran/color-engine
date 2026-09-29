#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform sampler2D u_curveLUT;  // 256x1 R8 texture (single luminance curve)
uniform float u_intensity;     // 0-1 blend with original

out vec4 fragColor;

// Luminance coefficients (Rec. 709)
const vec3 LUMA_COEFF = vec3(0.2126, 0.7152, 0.0722);

// Sample the luminance curve value from the LUT texture
float sampleCurve(float inputValue) {
  float clampedInput = clamp(inputValue, 0.0, 1.0);
  // Sample from single-row texture (v = 0.5 for texel center)
  return texture(u_curveLUT, vec2(clampedInput, 0.5)).r;
}

void main() {
  vec4 color = texture(u_image, v_texCoord);
  vec3 original = color.rgb;
  vec3 adjusted = original;

  // Calculate current luminance
  float luma = dot(adjusted, LUMA_COEFF);
  
  // Get adjusted luminance from curve
  float adjustedLuma = sampleCurve(luma);
  
  // Apply luminance adjustment while preserving color ratios
  float lumaDiff = abs(adjustedLuma - luma);
  if (lumaDiff > 0.001) {
    if (luma > 0.001) {
      // Scale RGB proportionally to preserve hue
      float scale = adjustedLuma / luma;
      adjusted = adjusted * scale;
    } else {
      // For very dark pixels, add the luminance adjustment
      adjusted = adjusted + vec3(adjustedLuma - luma);
    }
  }

  // Clamp final result
  adjusted = clamp(adjusted, 0.0, 1.0);

  // Blend with original based on intensity
  vec3 result = mix(original, adjusted, u_intensity);
  
  fragColor = vec4(result, color.a);
}
