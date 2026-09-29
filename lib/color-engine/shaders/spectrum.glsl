#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;

// Spatial Volume uniforms (per tonal range)
uniform vec3 u_shadowsTone;    // x: hue (0-1), y: saturation (-1 to 1), z: strength (0-1)
uniform vec3 u_midtonesTone;   // x: hue (0-1), y: saturation (-1 to 1), z: strength (0-1)
uniform vec3 u_highlightsTone; // x: hue (0-1), y: saturation (-1 to 1), z: strength (0-1)

// Spectral Balance uniforms
uniform float u_hueShift;        // -1 to 1 (maps to -0.5 to 0.5 rotation)
uniform float u_saturationShift; // -1 to 1

out vec4 fragColor;

// ============================================
// Color Space Conversion Functions
// ============================================

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ============================================
// Luminance and Tonal Weighting
// ============================================

// Calculate perceived luminance (Rec. 709)
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Smooth tonal weights using overlapping smoothstep curves
// This creates natural transitions between shadows/midtones/highlights
vec3 getTonalWeights(float luminance) {
  // Shadow weight: peaks at 0, fades out by 0.5
  float shadowWeight = 1.0 - smoothstep(0.0, 0.5, luminance);
  
  // Highlight weight: starts at 0.5, peaks at 1.0
  float highlightWeight = smoothstep(0.5, 1.0, luminance);
  
  // Midtone weight: bell curve centered at 0.5
  // Uses overlapping smoothsteps for smooth falloff
  float midtoneWeight = smoothstep(0.0, 0.5, luminance) * (1.0 - smoothstep(0.5, 1.0, luminance));
  
  // Normalize weights to sum to 1.0 for proper blending
  float totalWeight = shadowWeight + midtoneWeight + highlightWeight;
  return vec3(shadowWeight, midtoneWeight, highlightWeight) / max(totalWeight, 0.001);
}

// ============================================
// Spectrum Processing
// ============================================

// Apply tonal hue shift toward target hue
vec3 applyTonalHueShift(vec3 hsv, float targetHue, float strength) {
  if (strength <= 0.0) return hsv;
  
  // Calculate shortest path hue difference
  float hueDiff = targetHue - hsv.x;
  
  // Wrap to [-0.5, 0.5] for shortest rotation path
  if (hueDiff > 0.5) hueDiff -= 1.0;
  if (hueDiff < -0.5) hueDiff += 1.0;
  
  // Apply shift with strength factor
  hsv.x += hueDiff * strength;
  
  // Wrap hue to [0, 1]
  hsv.x = fract(hsv.x);
  
  return hsv;
}

// Apply saturation adjustment
vec3 applySaturationAdjust(vec3 hsv, float saturationDelta, float strength) {
  if (strength <= 0.0 || saturationDelta == 0.0) return hsv;
  
  // Apply saturation change scaled by strength
  hsv.y = clamp(hsv.y + saturationDelta * strength, 0.0, 1.0);
  
  return hsv;
}

void main() {
  vec4 color = texture(u_image, v_texCoord);
  vec3 rgb = color.rgb;
  
  // Convert to HSV for manipulation
  vec3 hsv = rgb2hsv(rgb);
  
  // Calculate luminance for tonal weighting
  float luminance = getLuminance(rgb);
  
  // Get smooth tonal weights
  vec3 weights = getTonalWeights(luminance);
  float shadowWeight = weights.x;
  float midtoneWeight = weights.y;
  float highlightWeight = weights.z;
  
  // ============================================
  // Apply Spatial Volume (per-tonal-range adjustments)
  // ============================================
  
  // Shadows adjustment
  if (u_shadowsTone.z > 0.0 && shadowWeight > 0.0) {
    float effectiveStrength = u_shadowsTone.z * shadowWeight;
    hsv = applyTonalHueShift(hsv, u_shadowsTone.x, effectiveStrength);
    hsv = applySaturationAdjust(hsv, u_shadowsTone.y, effectiveStrength);
  }
  
  // Midtones adjustment
  if (u_midtonesTone.z > 0.0 && midtoneWeight > 0.0) {
    float effectiveStrength = u_midtonesTone.z * midtoneWeight;
    hsv = applyTonalHueShift(hsv, u_midtonesTone.x, effectiveStrength);
    hsv = applySaturationAdjust(hsv, u_midtonesTone.y, effectiveStrength);
  }
  
  // Highlights adjustment
  if (u_highlightsTone.z > 0.0 && highlightWeight > 0.0) {
    float effectiveStrength = u_highlightsTone.z * highlightWeight;
    hsv = applyTonalHueShift(hsv, u_highlightsTone.x, effectiveStrength);
    hsv = applySaturationAdjust(hsv, u_highlightsTone.y, effectiveStrength);
  }
  
  // ============================================
  // Apply Spectral Balance (global adjustments)
  // ============================================
  
  // Global hue shift (map -1..1 to -0.5..0.5 rotation)
  if (u_hueShift != 0.0) {
    hsv.x = fract(hsv.x + u_hueShift * 0.5);
  }
  
  // Global saturation shift
  if (u_saturationShift != 0.0) {
    hsv.y = clamp(hsv.y + u_saturationShift, 0.0, 1.0);
  }
  
  // Convert back to RGB
  vec3 result = hsv2rgb(hsv);
  
  fragColor = vec4(result, color.a);
}
