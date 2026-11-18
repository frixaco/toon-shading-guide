import { sec, shot, box, widget } from './kit';

export const step8 = {
  title: 'Three spotlights, with HDRP\'s numbers',
  html: [
    sec({ mode: 'toon', lv: 70, pink: false, label: 'Step 7, lit by two test suns. The real scene has none' }, `
      <h2>8.1 From test suns to the real lights</h2>
      <p>The suns were scaffolding: a sun has one direction and the same strength everywhere, which made steps 1–7 easy to reason about.
      The Unity scene is lit by <b>three spotlights</b> close to the model: a strong violet one from the side, a pale blue one from behind, and a near-white one from the front.
      A spotlight differs from a sun in two ways, and both matter for the look:</p>
      <ul>
        <li><b>Direction varies per point.</b> L points from each point to the lamp. Light Evaluation's <b>Direction</b> already does this, so our N·L math works unchanged.</li>
        <li><b>Strength varies per point:</b> it falls off with distance and toward the edge of the cone. That's the new part.</li>
      </ul>
      <p>Blender spotlights have their own falloff, which isn't HDRP's. And our tree never used Blender's strength anyway
      (Light Info Color is colour only). So we reproduce HDRP's falloff ourselves, from HDRP's own numbers, stored on each lamp.</p>
    `),
    sec({ mode: 'toon', lv: 80, show: 'falloff', label: 'HDRP falloff per lamp, as RGB: red = Spot (2), green = Spot (1), blue = Spot (3)' }, `
      <h2>8.2 Data on the lamp: custom properties</h2>
      ${box('do', 'Do this', `<ol>
        <li>Delete both suns. Add three <b>Spot</b> lights at the positions in <code>step8.blend</code>: Spot Size 90.5°, Blend 0, Radius 0.025 m, any Power above 0. (90.5° is HDRP's full cone, so Blender's own cutoff lands exactly where HDRP's cone reaches 0. Power only has to be non-zero; our nodes compute the brightness.)</li>
        <li>On each, Object properties → <b>Custom Properties</b> → <b>New</b>, and add the six values shown: <code>hd_color</code>, <code>fwd</code>, <code>angle_scale</code>,
          <code>angle_offset</code>, <code>range_scale</code>, <code>channel</code>.</li>
      </ol>`)}
      ${shot('s8_lights', 'Spot Light (2)\'s custom properties. fwd is purple because a driver keeps it equal to the lamp\'s pointing direction.', 'narrow')}
      <p>A node can read them: the <b>Attribute</b> node, with its type set to <b>Light</b>, returns the named property of <i>the lamp currently being evaluated</i>.
      That's what lets one per-light tree use three different sets of numbers.</p>
      ${box('num', 'What each property is', `<ul>
        <li><code>hd_color</code>: HDRP's final light value, colour × intensity × camera exposure, already in \"pixel\" units. Spot (2) is (16.3, 7.9, 26.5): far above 1. Hold that thought.</li>
        <li><code>fwd</code>: the lamp's forward axis in world space. Set by drivers from the rotation, so rotating the lamp keeps it right. (Right-click a field → Add Driver; <code>step8.blend</code> has them.)</li>
        <li><code>angle_scale</code>, <code>angle_offset</code>, <code>range_scale</code>: HDRP's precomputed cone and range constants.</li>
        <li><code>channel</code>: (1,0,0), (0,1,0), (0,0,1). Unused until step 9.</li>
      </ul>`)}
      <h3>The falloff, from first principles</h3>
      <p>HDRP's attenuation is a product of three factors:</p>
      <p style="text-align:center;font-size:17px"><b>attenuation = 1/d² × window(d)² × cone(θ)²</b></p>
      <ul>
        <li><b>1/d²</b>: a point light's power spreads over a sphere of area 4π<i>d</i>². Twice as far, a quarter of the light. (Capped at <i>d</i> = 1 cm so it can't explode.)</li>
        <li><b>window</b> = clamp(1 − (<i>d</i>² · range_scale)², 0, 1): 1/<i>d</i>² never reaches 0, so the lamp would touch every object in the world.
          The window forces it to exactly 0 at the lamp's range (here 1/√0.01 = 10 m) while staying ≈1 close by.</li>
        <li><b>cone</b> = clamp(cos θ · 3.6 − 2.535, 0, 1), θ = angle between the lamp's axis and the ray to the point. Linear in cos θ: 1 inside 10.9°, 0 beyond 45.2° (half of the 90.5° cone).</li>
      </ul>
      <p>Why squared? A clamped straight line hits 0 with a corner. Its square, t², has slope 0 at t = 0, so the pool's edge fades out without a visible seam: the same reason smoothstep beat a straight line in step 4.</p>
      ${widget('falloff')}
      ${box('do', 'Build it as a group', `<ol>
        <li>Build the nodes in the material, select them and press <kbd>Ctrl G</kbd> to turn them into a group named <code>HDRP Spot Falloff</code>
          (or take it ready-made: <b>File → Append</b> → <code>step8.blend</code> → NodeTree → HDRP Spot Falloff). <kbd>Tab</kbd> enters and leaves a group.</li>
        <li>Inside: Light Evaluation (Distance, Direction) and Attribute nodes (Light) for the constants, wired as the formula above. Two outputs: the raw <b>Attenuation</b>,
          and <b>Toon Falloff</b> = smoothstep(0, 1, min(attenuation, 1)).</li>
      </ol>`)}
      ${shot('s8_group', 'Inside HDRP Spot Falloff. Top: 1/d and the range window. Middle: the cone. Right: product, square, then the toon version.')}
      ${box('why', 'Why does the toon shader clamp the attenuation to 1?', `
        <p>Within about a metre of the lamp, 1/d² is above 1. A physical shader would get brighter and brighter. The toon shader caps it at 1, then smoothsteps.
        So the falloff becomes a <b>mask</b>: full strength in the lamp's pool, a soft fade at its edge, nothing outside.
        Brightness inside the pool is decided by the lamp's colour and the material, not by distance. That's what keeps toon light looking flat and graphic.
        In the 3D view each lamp's pool is one colour channel: red, green and blue.</p>`)}
    `),
    sec({ mode: 'toon', lv: 80, label: 'Toon tree × hd_color × falloff, summed. Way too bright', ref: 's8_hot' }, `
      <h2>8.3 Wiring the lamps in</h2>
      ${box('do', 'Do this (Skin and Sweater)', `<ol>
        <li>Delete <b>Light Info</b>. Add an <b>Attribute</b> node, type <b>Light</b>, name <code>hd_color</code>, and a <b>Vector Math Scale</b> by <code>0.67</code>
          (Unity's Light Intensity). Wire its output → the \"× light colour\" Mix <b>B</b>.</li>
        <li>Add a <b>Group</b> node with HDRP Spot Falloff. Add a <b>Vector Math Scale</b>: the Mix result scaled by <b>Toon Falloff</b>. Wire it → <b>Diffuse Light</b>.</li>
      </ol>`)}
      ${shot('s8_lightcolor', 'Light attribute hd_color × 0.67 replaces Light Info.')}
      ${shot('s8_falloff', 'shade colour × light colour × Toon Falloff → Diffuse Light.')}
      <p>Compare: the body is blown out to white. The tree is right. The numbers are physical: Spot (2)'s hd_color is (16.3, 7.9, 26.5), and the test suns gave 1.
      HDRP works in real photometric units and an exposure, and SakuraRabbit compensated in the material.</p>
    `),
    sec({ mode: 'toon', lv: 81, knob: 'power', label: 'Albedo × Color Power 0.15', ref: 's8_sum' }, `
      <h2>8.4 Color Power: scaling the surface back down</h2>
      <p>Unity's <code>_ColorPower</code> = 0.15 multiplies the albedo. Only the product light × surface reaches the screen, so scaling the surface by 0.15
      is the same as scaling every light by 0.15. It's the material's exposure knob. Put it on the surface side and it's set once, for all lights.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Vector Math Scale</b> by <code>0.15</code> between the albedo Mix and Light Accumulation <b>Diffuse Color</b>.</li>
      </ol>`)}
      ${shot('s8_colorpower', 'albedo × Color Power 0.15 → Diffuse Color.')}
      <h3>The floor</h3>
      <p>The backdrop in Unity isn't toon. It's HDRP's standard Lit material, so we give it physically based diffuse lighting: Lambert's N·L with Disney's correction
      for rough surfaces (slightly brighter at grazing angles), × the same falloff and shadows, plus its faint blue emission. It's in <code>step8.blend</code> ready-made.
      Nothing new to learn there, it's step 1's Lambert written out by hand.</p>
      ${shot('s8_floor', 'The floor: HDRP/Lit\'s Disney diffuse, built from Math nodes, plus emission.')}
      <p>Better, but still not Unity. Where two lamps overlap the colours pile up, and the violet lamp burns the skin it hits. Step 9 fixes both.</p>
      ${shot('s8_viewport', 'Blender\'s viewport at the end of step 8.')}
    `),
  ].join(''),
};
