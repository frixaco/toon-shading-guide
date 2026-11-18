import { sec, shot, box, img } from './kit';

export const step12 = {
  title: 'Finishing: AO tint, vignette, grade, ACES',
  html: [
    sec({ mode: 'toon', lv: 120, cam: 'shot', label: 'AO tint: occluded creases pulled toward a warm red (Compare to see it)', ref: 's12_ao' }, `
      <h2>12.1 Ambient occlusion, used as a colour</h2>
      <p><b>Ambient occlusion</b> (AO) is the fraction of directions around a point that are <i>open</i>: 1 on an exposed surface, smaller in creases, armpits, where the sweater meets the skin.
      EEVEE estimates it on screen, looking up to a set distance from each point (0.25 m here), and writes it to the AO pass.</p>
      <p>Unity doesn't darken with it. It <b>tints</b>: <code>lighting × lerp(SSAO colour, white, AO)</code>, with the colour (0.78, 0.43, 0.43), a warm red.
      Creases get redder rather than greyer, like light bouncing inside skin. It's the same \"shadow has a colour\" idea as the 0.363 shadow tone, applied to contact shadows.</p>
      ${box('do', 'Do this', `<ol>
        <li>View Layer → Passes → Light: tick <b>Ambient Occlusion</b>, and set <b>Occlusion Distance</b> below it to <code>0.25 m</code>.</li>
        <li>Compositor: Math Power AO² → Mix Color (Mix) with Factor = that, A = <code>(0.776, 0.427, 0.427)</code>, B = white.</li>
        <li>Mix Color (Multiply), Factor = <code>toon_mask</code>, A = the image after the toon Mix, B = the tint. Insert it before the fog.</li>
      </ol>`)}
      ${shot('s12_ao', 'AO² → lerp(SSAO colour, white) → multiplied in, only on toon pixels.')}
      ${box('num', 'Why AO²', `<p>EEVEE's AO and HDRP's SSAO estimate the same thing in different ways and come out at different strengths. Squaring makes EEVEE's crease values darker
      (0.8 → 0.64) and matches the strength of the Unity render; it doesn't change where the occlusion is.</p>`)}
    `),
    sec({ mode: 'toon', lv: 121, cam: 'shot', label: 'Vignette: corners darkened, centre untouched' }, `
      <h2>12.2 Vignette: steer the eye to the centre</h2>
      <p>Darkening the edges of the frame is the oldest trick for pulling attention inward. HDRP's version is a function of the pixel's distance from the centre, per axis:</p>
      <p style="text-align:center"><b>d = clamp(|uv − 0.5| × 1.5, 0, 1)<sup>4.75</sup>, &nbsp; vignette = (1 − d<sub>x</sub>² − d<sub>y</sub>²)<sup>5</sup></b></p>
      <p>The power 4.75 keeps <i>d</i> near zero over most of the frame and lets it rise only near the borders, so the centre is untouched.
      The outer power 5 makes the fall-off steep once it starts. Using x and y separately is what gives a rounded-<i>rectangle</i> shape that follows the frame, not a circle.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add the <code>HDRP Vignette</code> group (Append from <code>step12.blend</code>) after the Bokeh Blur. Inside, <b>Image Coordinates → Normalized</b> gives each pixel's uv (0 … 1).</li>
      </ol>`)}
      ${shot('s12_vignette', 'The vignette group after depth of field.')}
    `),
    sec({ mode: 'toon', lv: 122, cam: 'shot', label: 'Colour adjustments: +0.3 EV, contrast −10, saturation +3', ref: 's12_grade' }, `
      <h2>12.3 The grade, done in the space Unity does it in</h2>
      <p>HDRP's <b>Color Adjustments</b> are three small edits, and their math is worth seeing, because each one is \"the obvious operation in the right space\":</p>
      <ul>
        <li><b>Post exposure +0.3 EV</b>: an EV is a doubling of light, so +0.3 EV = × 2<sup>0.3</sup> = × 1.23.</li>
        <li><b>Contrast −10</b>: brightness perception is roughly logarithmic, so contrast is a <i>scale in log space</i> around middle grey (0.18):
          log x → (log x − log 0.18) × c + log 0.18. Undo the log and that's <b>x = 0.18 · (x / 0.18)<sup>c</sup></b>, with c = 0.9. Middle grey stays put, darks rise, brights fall.</li>
        <li><b>Saturation +3</b>: lerp(luma, colour, 1.03), the same extrapolation as step 9.</li>
      </ul>
      <p>Unity does these in <b>ACES</b> colour spaces (wider-gamut RGB primaries: AP0 for exposure and contrast, AP1 for saturation, with AP1's own luma weights).
      A colour space is just a different basis for RGB, so converting is a 3×3 matrix. The group is: matrix → edit → matrix → edit → matrix back to Blender's sRGB primaries.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add the <code>HDRP Color Adjustments</code> group after the vignette.</li>
      </ol>`)}
      ${shot('s12_grade', 'The colour adjustments group, last in the compositor.')}
      ${shot('s12_grade_group', 'Inside: × 2^0.3 → sRGB→AP0 → contrast power around 0.18 → AP0→AP1 → saturation → AP1→sRGB.')}
    `),
    sec({ mode: 'toon', lv: 123, cam: 'shot', label: 'Final: ACES 1.3 view transform', ref: 's12_final' }, `
      <h2>12.4 ACES: now we want the film look</h2>
      <p>In step 1 we switched to <b>Standard</b> so we could design exact values. The design is done, and Unity ends with the <b>ACES</b> tone mapper, so we switch to it.
      A tone mapper is a curve from scene light (0 … ∞) to display (0 … 1). ACES's curve is an S: a gentle toe in the shadows, a long shoulder that compresses highlights instead of clipping them,
      and highlights that drift toward white as they get very bright, as film does.</p>
      ${box('do', 'Do this', `<ol>
        <li>Render → Color Management → <b>View: ACES 1.3</b>.</li>
      </ol>`)}
      ${shot('s12_aces', 'Color Management → View: ACES 1.3.', 'narrow')}
      <p>Turn on Compare and wipe across. This is the final Blender render; below is Unity's.</p>
      ${img('/goal/unity_final.png', 'The target: the Unity original.')}
      ${shot('s12_viewport', 'Blender\'s viewport at the end: the whole chain, live, with the viewport compositor on.')}
      ${box('num', 'How close', `<p>Measured pixel by pixel against the Unity frame, the average difference is 7.7 levels out of 255 (the full port built earlier in this project: 7.5).
      Most of what remains is the matcap: our tree follows Unity's code (<code>uv = mul(V, N).xy × 0.5 + 0.5</code>); with the matcap off, this guide's tree and that port give identical images.</p>`)}
    `),
    sec({ mode: 'toon', lv: 123, cam: 'shot', label: 'Final: ACES 1.3 view transform', ref: 's12_final' }, `
      <h2>12.5 The whole design, as decisions</h2>
      <p>Every node in the final tree is the answer to one question. If you can ask the questions, you can rebuild it, or design a different look:</p>
      <table>
        <tr><th>Question</th><th>Answer here</th><th>Step</th></tr>
        <tr><td>How does brightness depend on facing the light?</td><td>half-Lambert N·L × 0.5 + 0.5</td><td>3</td></tr>
        <tr><td>Where's the shadow edge, how wide?</td><td>smoothstep 0.518 … 0.662</td><td>4</td></tr>
        <tr><td>How dark, which tone?</td><td>× 0.942 + 0.058, lerp(0.363, lit)</td><td>4</td></tr>
        <tr><td>Do occluders count, and as what?</td><td>× smoothstep(shadow), before the strength dial: same tone as self-shadow</td><td>5</td></tr>
        <tr><td>Anything that doesn't follow the lights?</td><td>painted crease shading in the texture; matcap × albedo</td><td>4, 6</td></tr>
        <tr><td>How is the silhouette drawn?</td><td>inverted hull, width from a painted mask</td><td>7</td></tr>
        <tr><td>Does distance matter?</td><td>only as a mask: falloff clamped to 1, smoothstepped</td><td>8</td></tr>
        <tr><td>How bright overall?</td><td>Color Power 0.15 on the surface; cap each lamp at peak 7</td><td>8, 9</td></tr>
        <tr><td>How do lights combine?</td><td>max, not sum: one lamp owns each pixel</td><td>9</td></tr>
        <tr><td>How vivid?</td><td>saturation 1.94 skin / 1.46 sweater</td><td>9</td></tr>
        <tr><td>Edges?</td><td>rim from 1 − N·V, only on the lit side</td><td>10</td></tr>
        <tr><td>Contact shadows?</td><td>AO as a red tint, not darkening</td><td>12</td></tr>
        <tr><td>The photograph?</td><td>long lens, faint fog, far-only DOF, vignette, grade, ACES</td><td>11, 12</td></tr>
      </table>
      <p>Two principles cover almost all of it. <b>Order is the design</b>: snap before or after adding, multiply before or after the strength dial.
      And <b>if Blender can't do it in the material, pack numbers into passes and finish it in the compositor</b>, as with max blending and the rim.</p>
    `),
  ].join(''),
};
