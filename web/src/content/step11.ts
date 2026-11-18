import { sec, shot, box } from './kit';

export const step11 = {
  title: 'The Unity camera, fog and depth of field',
  html: [
    sec({ mode: 'toon', lv: 110, cam: 'shot', label: 'The Unity shot: 9.6° vertical field of view, 1469 × 985', ref: 's11_cam' }, `
      <h2>11.1 A long lens</h2>
      <p>The shading is finished. What's left is the <i>photography</i>: the camera and what happens to the image after rendering. These steps act on the whole picture,
      so they all live in the camera and the compositor.</p>
      <p>Unity's camera has a vertical field of view of only <b>9.6°</b>. Our guide camera has 30°. A narrow field of view means a long lens, used from far away.</p>
      ${box('why', 'Why a long lens flattens the figure', `
        <p>Perspective makes things shrink with distance: apparent size ∝ 1/d. What matters for a figure is the <b>ratio</b> between its nearest and farthest parts.
        A chest 10 cm closer than the shoulders, seen from 1 m, is 1/0.9 = 11% larger. Seen from 4 m it's 1/3.9 × 4 = 2.6% larger.
        From far away all parts are at nearly the same distance, so the drawing approaches an orthographic, \"flat\" one, the look of a painted illustration.
        To keep the figure the same size on screen from further away you narrow the field of view, and that's what 9.6° is.</p>`)}
      ${box('do', 'Do this', `<ol>
        <li>Add a camera named <code>Shot Camera</code> at the transform in <code>step11.blend</code>. Camera data: <b>Sensor Fit Vertical</b>, then set the <b>Field of View</b> to <code>9.6°</code>
          (Lens Unit: Field of View).</li>
        <li>Make it the scene camera (Scene properties → Camera). Output properties: Resolution <code>1469 × 985</code>.</li>
        <li>View Layer → Passes → Data: tick <b>Depth</b> and <b>Position</b>. We'll need both below.</li>
      </ol>`)}
      ${shot('s11_camera', 'Shot Camera: vertical sensor fit; in millimetres that is about a 143 mm lens on a 24 mm-high sensor.', 'narrow')}
      ${box('num', 'Why Sensor Fit Vertical', `<p>Unity specifies the vertical angle. Blender's default fit (Auto) applies the angle to the longer side, which here is the width.
      Vertical makes the 9.6° mean the same thing in both programs.</p>`)}
    `),
    sec({ mode: 'toon', lv: 111, cam: 'shot', label: 'Height fog: image × transmittance (subtle at this distance)', ref: 's11_fog' }, `
      <h2>11.2 Fog: light lost on the way to the camera</h2>
      <p>Air with particles in it absorbs or scatters a fixed fraction of light per metre. If a fraction σ is lost per metre, the light left after distance <i>t</i> obeys
      dI/dt = −σI, so I = I₀ e<sup>−σt</sup>. That e<sup>−σt</sup> is the <b>transmittance</b> T. HDRP describes σ through its <b>mean free path</b>: 80 m here,
      meaning σ = 1/80 per metre, the distance at which only e<sup>−1</sup> = 37% gets through.</p>
      <p>HDRP's fog is also <b>thinner with height</b>: σ(<i>h</i>) = (1/80) · e<sup>−(h − base)/H</sup>. <i>H</i>, the scale height, comes from the fog's Maximum Height (50 m): <i>H</i> = 50 × 0.1448 ≈ 7.2 m. Along a slanted ray σ changes, so instead of σ·<i>t</i> we integrate it, with <i>t</i> capped at the fog's max distance, 70 m.
      For an exponential the integral has a closed form, with <i>k</i> = <i>t</i> · cos(angle to vertical) / <i>H</i>:</p>
      <p style="text-align:center"><b>optical depth = σ<sub>camera</sub> · <i>t</i> · (1 − e<sup>−k</sup>) / <i>k</i></b>, &nbsp; T = e<sup>−optical depth</sup></p>
      <p>(1 − e<sup>−k</sup>)/<i>k</i> is the average of the exponential along the ray: 1 for a horizontal ray, smaller for rays climbing into thinner air.</p>
      ${box('do', 'Do this', `<ol>
        <li>In the compositor, add a <b>Group</b> node with <code>HDRP Height Fog</code> (Append it from <code>step11.blend</code>, or build it from the formula: Position − camera position → Length = <i>t</i>,
          dot with (0,0,1) / <i>t</i> = cos, then the Math chain above).</li>
        <li>Insert it right after the toon_mask Mix. Wire Render Layers <b>Position</b> → its Position input.</li>
      </ol>`)}
      ${shot('s11_fog', 'The fog group, inserted after the mask Mix. Position comes from the Position pass.')}
      ${shot('s11_fog_group', 'Inside HDRP Height Fog: ray length, slope, the closed-form integral, then image × e^(−depth).')}
      ${box('num', 'How much it does here', `<p>The character is about 1.8 m from the camera: T ≈ e<sup>−1.8/80</sup> ≈ 0.98, so 2% darker. The backdrop wall is further and loses a bit more.
      It's a small effect, but it's what separates the figure from the background slightly. Unity's fog also adds back light scattered toward the camera.
      Our group applies only the loss, and the final image still matches Unity closely (step 12), so whatever that term adds is small here.</p>`)}
    `),
    sec({ mode: 'toon', lv: 112, cam: 'shot', label: 'Depth of field: the background blurs (Compare to see it; this viewer skips the blur)', ref: 's11_dof' }, `
      <h2>11.3 Depth of field: a blur that grows with distance</h2>
      <p>A real lens focuses one distance sharply. A point at another distance lands on the sensor as a small disc, the <b>circle of confusion</b> (CoC), and bigger the further it is from focus.
      Unity's HDRP uses a manual, far-only version: no blur up to 1.68 m, then the disc grows linearly to its maximum at 2.0 m and stays there.</p>
      <p style="text-align:center"><b>CoC = clamp((depth − 1.68) / 0.32, 0, 1) × 11.9 px</b></p>
      <p>The character is inside 1.68 m and stays sharp; the backdrop behind is fully blurred.
      Blur radius is in pixels, so it must scale with the image: Unity's 13 px at 1080 lines is 13 × 985/1080 = 11.9 px for our 985.</p>
      ${box('do', 'Do this', `<ol>
        <li>From Render Layers <b>Depth</b>: Math Subtract 1.68 → Divide 0.32 (Clamp on) → Multiply 11.86.</li>
        <li>Add a <b>Bokeh Image</b> node, Flaps 5, Roundness 1 (a circle). Add <b>Bokeh Blur</b> after the fog: Bokeh Image → Bokeh, the CoC → <b>Size</b>.</li>
      </ol>`)}
      ${shot('s11_dof', 'Depth → CoC in pixels → Bokeh Blur, with a round bokeh.')}
      ${box('why', 'Why a bokeh shape, not a Gaussian blur?', `<p>A defocused point really does become a uniform disc (the image of the aperture), with a fairly hard edge. A Gaussian is a soft blob.
      Bright points in a lens-blurred background show as discs, and the disc kernel reproduces that.</p>`)}
      ${shot('s11_viewport', 'Blender\'s viewport at the end of step 11, through the Shot Camera.')}
    `),
  ].join(''),
};
