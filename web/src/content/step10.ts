import { sec, shot, box } from './kit';

export const step10 = {
  title: 'The sweater: knit bumps and a rim light',
  html: [
    sec({ mode: 'toon', lv: 92, label: 'Step 9: the sweater is a smooth grey tube; its knit is only painted', ref: 's9_sat' }, `
      <h2>10.1 Detail the mesh doesn't have</h2>
      <p>The big cable braids are modelled, but the fine knit (the ribs and stitches) exists only in the colour texture, so it can't catch light: turn a lamp and the stitches don't shade.
      Modelling every stitch would cost millions of triangles. Instead the sweater has a second texture, <code>Sweater_Normal.jpg</code>,
      that stores, per pixel, <b>which way the knit surface would face</b>. If the shader uses that direction instead of the mesh normal, every N·L computed
      from it shades the stitches as if they were real geometry.</p>
    `),
    sec({ mode: 'toon', lv: 100, label: 'Step 10: normal map on the sweater (N from the texture), plus the rim', ref: 's10_rim' }, `
      <h2>10.2 Decoding a normal map, by hand</h2>
      <p>A normal map pixel is a direction written in a <b>local frame</b> glued to the surface at that point, called <i>tangent space</i>:</p>
      <ul>
        <li><b>T</b> (tangent): the direction the texture's u axis runs across the surface;</li>
        <li><b>B</b> (bitangent): the direction its v axis runs;</li>
        <li><b>N</b>: the mesh normal, straight out.</li>
      </ul>
      <p>Each pixel stores (x, y) of that direction in R and G. A colour channel holds 0 … 1 and a direction component −1 … 1, so it was stored as d × 0.5 + 0.5
      (the same squeeze again, run backwards: d = c × 2 − 1). z is not needed: the direction has length 1 and points outward, so z = √(1 − x² − y²).
      Then the world-space normal is just the local coordinates times the frame's axes:</p>
      <p style="text-align:center;font-size:18px"><b>N′ = normalize(x·T + y·B + z·N)</b></p>
      <p>That's a change of basis, a 3×3 matrix with T, B, N as columns, written as three scale-and-add steps.</p>
      ${box('why', 'Why not Blender\'s own Normal Map node?', `
        <p>It does exactly this, but with <i>Blender's</i> tangents, computed from the UV map with Blender's method (MikkTSpace). The map was made for
        <b>Unity's</b> tangents. Two tangent methods usually agree, but can differ at UV seams, mirrored islands and stretched areas, and there a stitch would bend the wrong way.
        Our mesh carries Unity's own T and B as attributes <code>uT</code> and <code>uB</code>, so we decode with those.
        The general rule: a normal map is only meaningful together with the frame it was made in.</p>`)}
      ${box('do', 'Do this (Sweater only)', `<ol>
        <li>Add an <b>Image Texture</b> with <code>Sweater_Normal.jpg</code> and set its <b>Color Space</b> to <b>Non-Color</b>.</li>
        <li>Build the <b>Unity Normal Map</b> group (or Append it from <code>step10.blend</code>):
          Color → Vector Math Multiply Add (2, 2, 0) and (−1, −1, 0) → x, y; Dot Product with itself → 1 − (clamp) → Square Root → z;
          Attribute <code>uT</code> × x, Attribute <code>uB</code> × y, Geometry Normal × z → Add → Add → Normalize → output.</li>
        <li>Wire its Normal → the <b>Dot Product</b> (where Geometry Normal went) and → the matcap's <b>Vector Transform</b>.</li>
      </ol>`)}
      ${shot('s10_normal', 'Sweater: Sweater_Normal (Non-Color) → Unity Normal Map → Dot Product and the matcap.')}
      ${box('why', 'Why Non-Color?', `<p>An sRGB image is decoded with the screen curve on load: 0.5 stored becomes 0.214. For a picture that's right; for stored numbers it corrupts them.
      Non-Color reads the numbers as written. The same applies to the outline mask in step 7.</p>`)}
    `),
    sec({ mode: 'toon', lv: 100, show: 'rim', knob: 'rim', label: 'The rim mask per lamp (R/G/B = Spot 2/1/3): edge-facing × lit × in the pool' }, `
      <h2>10.3 Rim light: brighten the edges facing away from you</h2>
      <p>At the silhouette the surface turns sideways to the camera, so N·V → 0; facing the camera, N·V = 1. 1 − N·V is therefore an \"edge-ness\" value: 0 in the middle, 1 at the rim.
      Unity's rim shapes and thresholds it:</p>
      <p style="text-align:center"><b>rim = smoothstep(0.338 − 0.421, 0.338 + 0.421, (1 − N·V)<sup>1.26</sup>)</b></p>
      <p>The power slightly thins the band (values below 1 get smaller), and the wide smoothstep (−0.083 … 0.759) makes it a soft gradient, not a line.
      Then it's multiplied by <b>shade</b> (<code>_RimInLight</code> = 1): the rim only appears on the lit side, as if the light were wrapping around the edge.</p>
      ${box('do', 'Do this (Sweater)', `<ol>
        <li><b>Vector Math Dot Product</b>: the normal-map Normal · Geometry <b>Incoming</b>. Incoming is V, the direction from the point toward the camera.</li>
        <li><b>Math Subtract</b> 1 − that (Clamp on) → <b>Math Power</b> 1.26 → <b>Map Range</b> Smooth Step, −0.083 … 0.759.</li>
      </ol>`)}
      ${shot('s10_rim', 'Top row (Sweater): N·V → 1 − · → ^1.26 → smoothstep.')}
      <h3>Getting it out of the material</h3>
      <p>The rim also has a per-lamp scalar weight: rim × shade × falloff. Its colour is (0.65 + 0.35 × light colour) × rim colour, a mix of a fixed colour and the lamp's.
      The material can't use the lamp's colour (step 9), so we pack again, into the <b>Glossy</b> slot of Light Accumulation, which has its own pass:</p>
      ${box('do', 'Do this', `<ol>
        <li>Math Multiply rim × <b>Shadow Strength</b>, then × <b>Toon Falloff</b>. Then <code>channel</code> × that → Light Accumulation <b>Glossy Light</b>.</li>
        <li>Set <b>Glossy Color</b> to <b>white</b>.</li>
        <li>Two AOV Outputs, <code>toon_rimA</code> = 0.65 × 0.692 × rim colour and <code>toon_rimB</code> = 0.35 × 0.67 × 0.692 × rim colour (both constants).
          View Layer: tick <b>Specular → Light</b> and add both AOVs as Color.</li>
      </ol>`)}
      ${shot('s10_rimpack', 'The finished Sweater tree. Top row: the rim weight, packed by channel into Glossy Light.')}
      ${box('warn', 'Glossy Color must not be black', `<p>In step 3 we set it to black to switch glossy off. EEVEE skips a lobe whose colour is black entirely, and then its pass stays empty
      even though Glossy Light is wired. White keeps the lobe alive. It adds nothing visible here because the Combined image is replaced by the compositor anyway.</p>`)}
      ${box('do', 'In the compositor', `<ol>
        <li><b>Separate Color</b> the <b>Glossy Direct</b> pass into R.R, R.G, R.B.</li>
        <li>For each lamp: (rimA + rimB × hd<sub>i</sub>) × R channel <i>i</i>, added to light <i>i</i> before the max.</li>
      </ol>`)}
      ${shot('s10_comp', 'Compositor: per-lamp rim colour × weight, added to each light before the max.')}
      <p>In the 3D view, drag <b>Rim threshold</b>: lower spreads the rim inward, higher pushes it to the very edge.</p>
      ${shot('s10_viewport', 'Blender\'s viewport at the end of step 10.')}
    `),
  ].join(''),
};
