// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

// We scale the distance before adding it to the buffers so that we can store
// long distances for long segments. Use this value to unscale the distance.
#define LINE_DISTANCE_SCALE 2.0

layout (location = 0) in vec2 a_pos_normal;
layout (location = 1) in vec4 a_data;

layout (std140) uniform LineDynamicUBO {
    highp vec2 u_units_to_pixels;
    lowp float pad0, pad1;
};

layout (std140) uniform LinePatternUBO {
    highp mat4 u_matrix;
    mediump vec4 u_scale;
    highp vec2 u_texsize;
    mediump float u_ratio;
    highp float u_fade;
};

layout (std140) uniform LinePatternPropertiesUBO {
    lowp float u_blur;
    lowp float u_opacity;
    lowp float u_offset;
    mediump float u_gapwidth;
    mediump float u_width;

    highp float pad2;
    highp vec2 pad3;
};

layout (std140) uniform LinePatternTilePropertiesUBO {
    lowp vec4 u_pattern_from;
    lowp vec4 u_pattern_to;
};

layout (std140) uniform LinePatternInterpolationUBO {
    lowp float u_blur_t;
    lowp float u_opacity_t;
    lowp float u_offset_t;
    lowp float u_gapwidth_t;
    lowp float u_width_t;
    lowp float u_pattern_from_t;
    lowp float u_pattern_to_t;

    highp float pad4;
};

out vec2 v_normal;
out vec2 v_width2;
out float v_linesofar;
out float v_gamma_scale;

#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float offset
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define mediump float width
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to

void main() {
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float offset
    #pragma mapbox: initialize mediump float gapwidth
    #pragma mapbox: initialize mediump float width
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / DEVICE_PIXEL_RATIO / 2.0;

    vec2 a_extrude = a_data.xy - 128.0;
    float a_direction = mod(a_data.z, 4.0) - 1.0;
    float a_linesofar = (floor(a_data.z / 4.0) + a_data.w * 64.0) * LINE_DISTANCE_SCALE;
    // float tileRatio = u_scale.y;
    vec2 pos = floor(a_pos_normal * 0.5);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = a_pos_normal - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;
    v_normal = normal;

    // these transformations used to be applied in the JS and native code bases.
    // moved them into the shader for clarity and simplicity.
    gapwidth = gapwidth / 2.0;
    float halfwidth = width / 2.0;
    offset = -1.0 * offset;

    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth == 0.0 ? 0.0 : ANTIALIASING);

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    mediump vec2 dist = outset * a_extrude * scale;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);

    vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);
    gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;

    // calculate how much the perspective view squishes or stretches the extrude
    float extrude_length_without_perspective = length(dist);
    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_units_to_pixels);
    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;

    v_linesofar = a_linesofar;
    v_width2 = vec2(outset, inset);
}
