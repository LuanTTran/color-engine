#version 300 es

// Vertex shader for fullscreen quad rendering
// Simple passthrough for LUT processing

// Input attributes
in vec2 a_position;
in vec2 a_texCoord;

// Output to fragment shader
out vec2 v_texCoord;

void main() {
    // Pass texture coordinates directly to fragment shader
    // Y-axis flipping is handled via texture coordinates in the quad
    v_texCoord = a_texCoord;
    
    // Convert position to clip space
    gl_Position = vec4(a_position, 0.0, 1.0);
}
