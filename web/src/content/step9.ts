import { sec, shot, box } from './kit';

export const step9 = {
  title: 'Brightest light wins: cap, max, saturation',
  html: [
    sec({ mode: 'toon', lv: 81, label: 'Step 8: lights summed, the violet lamp burns the skin', ref: 's8_sum' }, `
      <h2>9.1 Two problems left from step 8</h2>
      <ol>
        <li><b>One lamp is far stronger than the others.</b> Spot (2) delivers 0.67 × (16.3, 7.9, 26.5) = (10.9, 5.3, 17.8). Even after Color Power that pushes the lit skin past 1 and it clips.</li>
        <li><b>Overlapping lamps add.</b> Where the violet and the white lamp both reach, you get violet + white, brighter and paler than either. A painter would paint the stronger light, not their sum.</li>
      </ol>
      <p>Unity's shader handles them with two rules, one per problem: a <b>cap</b> on each lamp's lit colour, and <b>max</b> instead of + between lamps.</p>
    `),
    sec({ mode: 'toon', lv: 90, label: 'Each lamp\'s lit colour capped at a peak of 7', ref: 's9_cap' }, `
      <h2>9.2 The cap: limit the peak, keep the hue</h2>
      <p>Unity's <code>ToonLitLightColor</code>: if the brightest channel of the light colour is above 7, scale the <b>whole colour</b> down so that channel is exactly 7.</p>
      <p style="text-align:center"><b>lit colour = lc × min(7 / max(r, g, b), 1)</b></p>
      <p>Why scale all three channels by one number instead of clamping each channel at 7? Clamping changes the <b>ratios</b> between r, g and b, and the ratios are the hue.
      (10.9, 5.3, 17.8) clamped per channel is (7, 5.3, 7): a different, washed-out colour. Scaled, it's (4.3, 2.1, 7.0): the same violet, dimmer.</p>
      <p>Only Spot (2) is above the limit: its cap is 7 / 17.8 = <b>0.394</b>. The other two peak at 5.1, so their cap is 1 and nothing changes.</p>
      ${box('do', 'Do this (Skin and Sweater)', `<ol>
        <li>From the <code>hd_color × 0.67</code> node, add <b>Separate Color</b>, then two <b>Math → Maximum</b> nodes: max(R, G), then max(that, B). That's the peak.</li>
        <li><b>Math → Divide</b>: <code>7</code> / peak. Then <b>Math → Minimum</b> with <code>1</code>.</li>
        <li>Wire it → Shadow Tone Mix <b>B</b> (it was 1.0).</li>
      </ol>`)}
      ${shot('s9_cap', 'Bottom row: hd_color × 0.67 → Separate Color → max → max → 7 / peak → min(·, 1) → Shadow Tone B.')}
      ${box('why', 'Why into Shadow Tone B and not after the whole Mix?', `
        <p>Unity caps only the <b>lit</b> side; the shadow side is shadow tone × the uncapped light. Shadow Tone is lerp(0.363, B, shade) and the whole thing is then multiplied by lc,
        so putting the cap in B gives lit = cap × lc and shadow = 0.363 × lc. Exactly Unity.</p>
        <p>Look at what that does to the violet lamp: lit is 0.394 × lc and shadow is 0.363 × lc. <b>Almost the same brightness.</b> Under the strongest lamp the toon bands nearly vanish,
        and the shape comes from the other two lamps. It's a side effect of the rule, and it's part of the look.</p>`)}
    `),
    sec({ mode: 'toon', lv: 90, show: 'weights', label: 'The packed weights: each lamp\'s scalar weight in its own channel (R = Spot 2, G = Spot 1, B = Spot 3)' }, `
      <h2>9.3 Max is impossible in the material, so pack</h2>
      <p>Unity's light loop is <code>lighting = max(lighting, thisLight)</code> (<code>_UseMaxLightBlend</code> is on). Light Accumulation can only <b>add</b>.
      The material never sees the three lamps side by side, only one at a time, and the sum at the end. So the max has to happen <b>after</b> rendering,
      in the compositor, which sees whole images. The problem: the render only gives us the sum. How do we get three separate numbers out of one sum?</p>
      <p>Look at what changes between lamps. In Unity's formula each lamp's colour at a pixel is</p>
      <p style="text-align:center"><b>light<sub>i</sub> = albedo × hd<sub>i</sub> × w<sub>i</sub></b>, &nbsp; w<sub>i</sub> = 0.67 × lerp(0.363, cap<sub>i</sub>, shade<sub>i</sub>) × falloff<sub>i</sub></p>
      <p>albedo is the same for every lamp. hd<sub>i</sub> is a constant per lamp, known in advance. The only per-pixel, per-lamp unknown is one <b>scalar</b> w<sub>i</sub>.
      Three lamps, three scalars, and a colour has three channels. So lamp <i>i</i> writes w<sub>i</sub> into channel <i>i</i> and zero into the others.
      Adding (w<sub>1</sub>, 0, 0) + (0, w<sub>2</sub>, 0) + (0, 0, w<sub>3</sub>) loses nothing: the sum <i>is</i> the vector (w<sub>1</sub>, w<sub>2</sub>, w<sub>3</sub>).
      It's the same idea as packing three bytes into one int.</p>
      ${box('do', 'Do this (Skin and Sweater)', `<ol>
        <li>Delete the colour Mix (× light colour) and the vector × falloff.</li>
        <li><b>Math Multiply</b> Shadow Tone × <code>0.67</code>, then <b>Math Multiply</b> × Toon Falloff. That's w.</li>
        <li><b>Attribute</b> (Light) <code>channel</code> → <b>Vector Math Scale</b> by w → <b>Diffuse Light</b>.</li>
      </ol>`)}
      ${shot('s9_pack', 'Light Weight (× 0.67) → × falloff → channel × w → Diffuse Light.')}
      <p>The lamp's own colour has left the material entirely. It will be multiplied back in by the compositor. That's why <code>channel</code> was on the lamps since step 8.</p>
      ${box('warn', 'The price', `<p>This works for at most three lamps that matter at once (three channels). A fourth would need a second render pass or a second view layer.</p>`)}
    `),
    sec({ mode: 'toon', lv: 90, show: 'weights', label: 'The packed weights (what the Diffuse Direct pass will contain)' }, `
      <h2>9.4 Getting the numbers out: passes and AOVs</h2>
      <p>A render can save more than the final picture. Each extra image is a <b>pass</b>. <b>Diffuse Direct</b> is the light that arrived in Diffuse Light, <i>before</i> it's multiplied by Diffuse Color.
      That's exactly our packed (w<sub>1</sub>, w<sub>2</sub>, w<sub>3</sub>).</p>
      <p>We also need a few per-pixel values that aren't light. The <b>AOV Output</b> node (\"arbitrary output value\") writes any colour or number into a named pass of your choice:</p>
      <ul>
        <li><code>toon_albedo</code>: albedo × Color Power, the part every lamp shares.</li>
        <li><code>toon_mask</code>: 1 on the character. The floor doesn't write it, so it's 0 there. Tells the compositor which pixels to rebuild.</li>
        <li><code>toon_sat</code>: the material's saturation (Skin 1.939, Sweater 1.46). Used in 9.6.</li>
      </ul>
      ${box('do', 'Do this', `<ol>
        <li>In both materials add three <b>AOV Output</b> nodes with those names. Wire Color Power → toon_albedo's <b>Color</b>; type <code>1</code> into toon_mask's Value, and the saturation into toon_sat's.</li>
        <li><b>View Layer</b> properties → <b>Passes</b>: tick <b>Light → Diffuse → Light</b>. Under <b>Shader AOV</b> add <code>toon_albedo</code> (Color), <code>toon_mask</code> and <code>toon_sat</code> (Value).</li>
      </ol>`)}
      ${shot('s9_aov', 'The three AOV Outputs.')}
      ${shot('s9_passes', 'View Layer → Passes: Diffuse Light on.', 'narrow')}
    `),
    sec({ mode: 'toon', lv: 91, label: 'In the compositor: light i = albedo × hd_i × W_i, then max', ref: 's9_max' }, `
      <h2>9.5 The compositor: per-pixel math on whole images</h2>
      <p>The compositor is a node editor that runs <b>after</b> rendering. Its wires carry images instead of single values, but a Math node there does exactly what it does in a material:
      the same operation on every pixel. Open it with the <b>Compositing</b> workspace tab, or switch any editor to <b>Compositor</b>, and press <b>New</b>.</p>
      ${box('do', 'Do this', `<ol>
        <li>The <b>Render Layers</b> node shows every pass as an output. <b>Separate Color</b> its <b>Diffuse Direct</b> into W.R, W.G, W.B.</li>
        <li>For each lamp: an <b>RGB</b> node holding its hd_color, <b>Vector Math Multiply</b> toon_albedo × hd, then <b>Scale</b> by its W channel. That's light<sub>i</sub>.</li>
        <li><b>Vector Math Maximum</b> of light 1 and light 2, then again with light 3 → Group Output.</li>
      </ol>`)}
      ${shot('s9_rebuild', 'Render Layers → Separate Color (W). Each lamp: albedo × hd_color × W.channel.')}
      ${shot('s9_max', 'max(light 1, light 2), then max with light 3.')}
      ${box('num', 'Keeping hd_color in one place', `<p>The RGB nodes in <code>step9.blend</code> have drivers that read each lamp's <code>hd_color</code>, so editing a lamp updates the compositor. Right-click a value → <b>Copy as New Driver</b> on the lamp, then <b>Paste Driver</b> on the RGB field.</p>`)}
      <p>The rebuilt image is only valid where toon_mask is 1. Everywhere else, keep Blender's normal render:</p>
      ${box('do', 'Do this', `<ol>
        <li><b>Mix Color</b>, blend Mix: Factor = <code>toon_mask</code>, A = Render Layers <b>Image</b>, B = the max → Group Output.</li>
        <li>In the 3D viewport: Viewport Shading popover → <b>Compositor: Always</b>. Now Rendered view shows the compositor result live.</li>
      </ol>`)}
      ${shot('s9_mask', 'Mix by toon_mask: floor from the normal render, character from the rebuild.')}
      ${box('why', 'Why max is the right look', `
        <p>max picks one lamp per pixel: the one that paints it brightest. Each region of the body belongs to one lamp and takes that lamp's colour cleanly, with a visible border where ownership changes.
        That's how a painter divides a figure into light zones. A sum blends every zone into a muddier, paler average.</p>`)}
    `),
    sec({ mode: 'toon', lv: 92, label: 'Step 9 result: saturation 1.939 (skin) and 1.46 (sweater)', ref: 's9_sat' }, `
      <h2>9.6 Saturation past 1</h2>
      <p>Unity's last lighting step is <code>lerp(luma, colour, saturation)</code>. Think of a colour as a point in RGB space. The grey of the same brightness, (L, L, L), is the nearest point on the grey axis.
      lerp at 0 lands on the grey, at 1 on the colour, and above 1 it <b>continues past the colour</b>, away from grey. Hue and brightness stay; only the distance from grey grows.</p>
      <p>L is <b>luma</b>, brightness as the eye weights it: 0.2127 R + 0.7152 G + 0.0722 B. Green counts most because our eyes are most sensitive to it.</p>
      ${box('do', 'Do this', `<ol>
        <li>In the compositor, between the max and the toon_mask Mix: <b>Vector Math Dot Product</b> of the max with <code>(0.2127, 0.7152, 0.0722)</code>. That's L.</li>
        <li><b>Mix Color</b>, blend Mix, <b>Clamp Factor off</b>: Factor = <code>toon_sat</code>, A = L, B = the max.</li>
      </ol>`)}
      ${shot('s9_saturation', 'Luma, then lerp(luma, colour, toon_sat), before the mask Mix.')}
      ${box('why', 'Why Clamp Factor off?', `<p>Clamped, a factor of 1.939 becomes 1 and nothing happens. Extrapolation is the whole point.</p>`)}
      <p>Compare: the skin colour zones are now vivid and distinct. This is the look of the Unity original, still without rim light and the camera finish.</p>
      ${shot('s9_viewport', 'Blender\'s viewport at the end of step 9, with the viewport compositor on.')}
    `),
  ].join(''),
};
