#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_offset;        // Kawase offset (iteration-based)
uniform int u_apertureShape;   // 0=circular, 1=hexagonal, 2=octagonal, 3=anamorphic
uniform float u_anamorphicRatio; // Horizontal stretch for anamorphic (default 2.0)

out vec4 fragColor;

// Hexagonal sampling directions (6 directions at 60° intervals)
const vec2 HEX_DIRS[6] = vec2[](
  vec2(1.0, 0.0),
  vec2(0.5, 0.866),
  vec2(-0.5, 0.866),
  vec2(-1.0, 0.0),
  vec2(-0.5, -0.866),
  vec2(0.5, -0.866)
);

// Octagonal sampling directions (8 directions at 45° intervals)
const vec2 OCT_DIRS[8] = vec2[](
  vec2(1.0, 0.0),
  vec2(0.707, 0.707),
  vec2(0.0, 1.0),
  vec2(-0.707, 0.707),
  vec2(-1.0, 0.0),
  vec2(-0.707, -0.707),
  vec2(0.0, -1.0),
  vec2(0.707, -0.707)
);

// Standard Dual Kawase downsample/upsample kernel
// This samples in a cross pattern with diagonal corners
vec3 kawaseBlurCircular(vec2 uv, vec2 texel, float offset) {
  vec3 color = texture(u_image, uv).rgb * 4.0;
  
  color += texture(u_image, uv + texel * vec2(-offset, -offset)).rgb;
  color += texture(u_image, uv + texel * vec2( offset, -offset)).rgb;
  color += texture(u_image, uv + texel * vec2(-offset,  offset)).rgb;
  color += texture(u_image, uv + texel * vec2( offset,  offset)).rgb;
  
  return color / 8.0;
}

// Hexagonal blur - 6 directional samples for lens-like bokeh
vec3 kawaseBlurHexagonal(vec2 uv, vec2 texel, float offset) {
  vec3 color = texture(u_image, uv).rgb * 2.0;
  
  for (int i = 0; i < 6; i++) {
    vec2 dir = HEX_DIRS[i] * offset;
    color += texture(u_image, uv + texel * dir).rgb;
  }
  
  return color / 8.0;
}

// Octagonal blur - 8 directional samples for more rounded bokeh
vec3 kawaseBlurOctagonal(vec2 uv, vec2 texel, float offset) {
  vec3 color = texture(u_image, uv).rgb * 2.0;
  
  for (int i = 0; i < 8; i++) {
    vec2 dir = OCT_DIRS[i] * offset;
    color += texture(u_image, uv + texel * dir).rgb;
  }
  
  return color / 10.0;
}

// Anamorphic blur - horizontal stretch for cinematic lens flare look
vec3 kawaseBlurAnamorphic(vec2 uv, vec2 texel, float offset, float ratio) {
  vec3 color = texture(u_image, uv).rgb * 4.0;
  
  // Stretch horizontally by ratio (typically 2:1)
  vec2 stretchedTexel = texel * vec2(ratio, 1.0);
  
  color += texture(u_image, uv + stretchedTexel * vec2(-offset, -offset * 0.5)).rgb;
  color += texture(u_image, uv + stretchedTexel * vec2( offset, -offset * 0.5)).rgb;
  color += texture(u_image, uv + stretchedTexel * vec2(-offset,  offset * 0.5)).rgb;
  color += texture(u_image, uv + stretchedTexel * vec2( offset,  offset * 0.5)).rgb;
  
  // Add extra horizontal samples for streak effect
  color += texture(u_image, uv + stretchedTexel * vec2(-offset * 1.5, 0.0)).rgb * 0.5;
  color += texture(u_image, uv + stretchedTexel * vec2( offset * 1.5, 0.0)).rgb * 0.5;
  
  return color / 9.0;
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec3 color;
  
  if (u_apertureShape == 0) {
    // Circular - standard Kawase
    color = kawaseBlurCircular(v_texCoord, texel, u_offset);
  } else if (u_apertureShape == 1) {
    // Hexagonal
    color = kawaseBlurHexagonal(v_texCoord, texel, u_offset);
  } else if (u_apertureShape == 2) {
    // Octagonal
    color = kawaseBlurOctagonal(v_texCoord, texel, u_offset);
  } else {
    // Anamorphic
    color = kawaseBlurAnamorphic(v_texCoord, texel, u_offset, u_anamorphicRatio);
  }
  
  fragColor = vec4(color, texture(u_image, v_texCoord).a);
}
