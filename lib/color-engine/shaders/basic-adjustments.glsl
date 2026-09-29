#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_exposure;

out vec4 fragColor;

// sRGB colorspace luminosity factor (WCAG relative luminance)
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec4 color = texture(u_image, v_texCoord);

  // Exposure: multiply RGB by exposure factor
  // u_exposure is in range -1 to 1, convert to multiplier (0.5 to 2.0)
  float exposureMultiplier = pow(2.0, u_exposure);
  color.rgb *= exposureMultiplier;

  // Brightness: additive adjustment
  color.rgb += u_brightness;

  // Contrast: expand/compress around midpoint
  color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;

  // Saturation: mix between grayscale and color
  float luminance = dot(color.rgb, LUMA);
  vec3 grayscale = vec3(luminance);
  color.rgb = mix(grayscale, color.rgb, 1.0 + u_saturation);

  color.rgb = clamp(color.rgb, 0.0, 1.0);

  fragColor = vec4(color.rgb, color.a);
}


