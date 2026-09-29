#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_fadeAmount;
uniform vec3 u_tintColor;

out vec4 fragColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);
  
  // Lift blacks (add fadeAmount to RGB, scaled)
  vec3 lifted = color.rgb + (u_fadeAmount * 0.15);
  
  // Apply tint (blend with tint color based on fadeAmount)
  vec3 tinted = mix(lifted, u_tintColor, u_fadeAmount * 0.2);
  
  // Reduce contrast slightly (pull toward midgray)
  vec3 faded = mix(vec3(0.5), tinted, 1.0 - u_fadeAmount * 0.3);
  
  // Clamp to valid range
  faded = clamp(faded, 0.0, 1.0);
  
  fragColor = vec4(faded, color.a);
}
