#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_originalImage;
uniform sampler2D u_blurredImage;
uniform float u_intensity;
uniform float u_highlightGlow;
uniform float u_softness;

out vec4 fragColor;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 original = texture(u_originalImage, v_texCoord);
  vec4 blurred = texture(u_blurredImage, v_texCoord);

  float lum = luminance(original.rgb);
  float highlightMask = smoothstep(0.6, 1.0, lum);

  vec3 softened = mix(original.rgb, blurred.rgb, clamp(u_softness, 0.0, 1.0));
  vec3 glow = mix(original.rgb, blurred.rgb, clamp(u_highlightGlow, 0.0, 1.0)) * highlightMask;

  vec3 combined = softened + glow;
  vec3 finalColor = mix(original.rgb, combined, clamp(u_intensity, 0.0, 1.0));

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), original.a);
}


