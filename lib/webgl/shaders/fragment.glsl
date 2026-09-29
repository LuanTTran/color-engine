#version 300 es
precision highp float;

// Fragment shader for 3D LUT lookup from 2D 512x512 texture
// Implements mathematical mapping: R = (blue * 512) + red, G = green

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_image;      // Source image texture
uniform sampler2D u_lut;        // 512x512 LUT texture
uniform float u_lutSize;        // LUT size (512.0)
uniform float u_intensity;     // LUT intensity (0.0 to 1.0)

// Output
out vec4 fragColor;

vec3 applyLUT(vec3 color) {
    // Clamp input color to valid range
    color = clamp(color, 0.0, 1.0);
    
    // LUT configuration - use uniform values
    float lutSize = 64.0;                    // 3D LUT dimension (64³)
    float slicesPerRow = 8.0;                // 8×8 grid arrangement
    float pixelSize = 1.0 / u_lutSize;       // Single pixel in texture (use uniform)
    float sliceSize = 64.0 / u_lutSize;      // Size of one slice in texture coordinates
    
    // Scale input color to LUT coordinate space (0-63)
    vec3 scaledColor = color * (lutSize - 1.0);
    
    // Extract integer and fractional parts for trilinear interpolation
    vec3 baseColor = floor(scaledColor);
    vec3 nextColor = min(baseColor + 1.0, lutSize - 1.0);
    vec3 blend = scaledColor - baseColor;
    
    // Calculate slice positions for blue interpolation
    float baseBlue = baseColor.b;
    float nextBlue = nextColor.b;
    
    // Convert blue slice indices to 8×8 grid coordinates
    vec2 baseSliceGrid = vec2(
        mod(baseBlue, slicesPerRow),
        floor(baseBlue / slicesPerRow)
    );
    
    vec2 nextSliceGrid = vec2(
        mod(nextBlue, slicesPerRow),
        floor(nextBlue / slicesPerRow)
    );
    
    // Calculate texture coordinates for base blue slice
    vec2 baseSliceOffset = baseSliceGrid * sliceSize;
    vec2 basePixelCoord = vec2(baseColor.r, baseColor.g) * pixelSize;
    vec2 lutCoord1 = baseSliceOffset + basePixelCoord + pixelSize * 0.5;
    
    // Calculate texture coordinates for next blue slice  
    vec2 nextSliceOffset = nextSliceGrid * sliceSize;
    vec2 nextPixelCoord = vec2(baseColor.r, baseColor.g) * pixelSize;
    vec2 lutCoord2 = nextSliceOffset + nextPixelCoord + pixelSize * 0.5;
    
    // Sample LUT texture at both blue levels
    vec3 lutColor1 = texture(u_lut, lutCoord1).rgb;
    vec3 lutColor2 = texture(u_lut, lutCoord2).rgb;
    
    // Interpolate between blue slices for smooth transitions
    vec3 lutResult = mix(lutColor1, lutColor2, blend.b);
    
    return lutResult;
}

void main() {
    // Sample the original image
    vec4 originalColor = texture(u_image, v_texCoord);
    
    // Apply LUT transformation to RGB channels
    vec3 lutColor = applyLUT(originalColor.rgb);
    
    // Blend between original and LUT-processed color based on intensity
    vec3 finalColor = mix(originalColor.rgb, lutColor, u_intensity);
    
    // Output final color with original alpha
    fragColor = vec4(finalColor, originalColor.a);
}
