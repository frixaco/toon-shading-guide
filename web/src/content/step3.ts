import { sec, shot, box, widget, s } from './kit';

const REF = { ref: 's3_toon', refPink: 's3_two' };

export const step3 = {
  title: 'Do the light math yourself, per light',
  html: [
    sec({ mode: 'toon2', stage: 'final', pink: true, label: 'The problem from step 2: two suns merge into one measurement', ref: 's2_toon', refPink: 's2_two' }, `
      <h2>3.1 The plan</h2>
      <p>Step 2 let Blender do the light math and handed us one total. Now we do the math ourselves, and we do it <b>once for every light</b>:</p>
      <ol>
        <li>For one light: how directly does this point face it? That's the same cos(angle) Lambert used.</li>
        <li>Snap that into lit or shadow with a Color Ramp.</li>
        <li>Tint the result with <b>that light's</b> colour.</li>
        <li>Repeat for every light and <b>add</b> the results.</li>
      </ol>
      <p>Blender 5 has a node made for exactly this: <b>Light Accumulation</b>. Whatever you wire into its <b>Diffuse Light</b> input is
      computed <b>separately for each lamp</b>, and the results are added up. Inside that wiring, two more nodes tell you about
      <i>the lamp currently being processed</i>: <b>Light Evaluation</b> (where it is relative to this point) and <b>Light Info</b> (its colour).</p>
      ${box('why', 'Why can\'t I just copy the tree three times, one per light?', `
        <p>You could, with a separate Shader to RGB per light. But a material can't see one lamp alone, since Shader to RGB always sees <i>all</i> of them.
        You'd need tricks like separate render layers. Light Accumulation runs your per-light wiring once per lamp, so adding a fourth lamp just works.</p>`)}
      <p>First we need a way to compute \"how directly does it face the light\" without a BSDF. That's a <b>dot product</b>.</p>
    `),
    sec({ mode: 'dot', label: 'Dot Product of Normal and light Direction (white sun). Blue = negative' }, `
      <h2>3.2 \"How much does it face the light?\" as math: the dot product</h2>
      <p>Two arrows describe the situation at every point:</p>
      <ul>
        <li>The <b>normal</b> (N): an arrow of length 1 sticking straight out of the surface. It says which way the surface faces.</li>
        <li>The <b>light direction</b> (L): an arrow of length 1 pointing from the surface toward the light.</li>
      </ul>
      <p>The <b>dot product</b> N·L multiplies the arrows piece by piece and adds the pieces: N<sub>x</sub>L<sub>x</sub> + N<sub>y</sub>L<sub>y</sub> + N<sub>z</sub>L<sub>z</sub>.
      For two arrows of length 1, that sum is <b>cos of the angle between them</b>. That's the number Lambert's flashlight gave us in step 1.
      Picture it as the shadow L casts onto N: when L points along N the shadow has full length 1, when L is sideways it's 0, and when L points behind it's negative.</p>
      ${widget('dot')}
      ${box('do', 'Do this (Skin tree fresh again)', `<ol>
        <li>Delete everything except Material Output.</li>
        <li><kbd>Shift A</kbd> → <b>Input</b> → <b>Geometry</b>. Its <b>Normal</b> ${s('vector')} is N.</li>
        <li><kbd>Shift A</kbd> → <b>Input</b> → <b>Light Evaluation</b>. Its <b>Direction</b> ${s('vector')} is L for the current lamp. Leave its dropdown on <i>Diffuse</i>.</li>
        <li><kbd>Shift A</kbd> → <b>Utilities</b> → <b>Math</b> → <b>Vector Math</b>, set to <b>Dot Product</b>.
          Wire Geometry <b>Normal</b> → first input, Light Evaluation <b>Direction</b> → second input.</li>
      </ol>`)}
      ${shot('s3_dot', 'Geometry · Normal and Light Evaluation · Direction → Vector Math (Dot Product).')}
      ${box('num', 'Can I see it in Blender?', `
        <p>Not on its own yet. Light Evaluation only has a value <i>inside</i> a Light Accumulation, because \"the current lamp\" only exists there.
        Once Light Accumulation is in (3.6) you can peek at any per-light number: wire it temporarily into <b>Diffuse Light</b>, with <b>Diffuse Color</b> white.
        Light Accumulation clamps negative numbers to 0, so the far side shows black, not blue. The 3D view here paints negatives blue so you can see them.</p>`)}
      <p>The 3D view shows the raw dot product for the white sun. White where the body faces it, black at the 90° line,
      <span style=\"color:var(--blue)\">blue</span> where it faces away. The values there go down to −1.</p>
    `),
    sec({ mode: 'remap', label: 'Dot × 0.5 + 0.5: the whole range squeezed into 0…1' }, `
      <h2>3.3 Make room for the dark side: × 0.5 + 0.5</h2>
      <p>The dot product runs from −1 to 1, but a Color Ramp's Fac only covers 0 to 1. Anything below 0 piles up at the left end.
      The whole back half of the body would become one value, and you could never place a stop there.</p>
      <p>The fix is to squeeze −1…1 into 0…1: <b>multiply by 0.5, then add 0.5</b>. −1 becomes 0, 0 becomes 0.5, and 1 stays 1.
      Nothing is lost. The \"sideways to the light\" line now sits at 0.5 in the middle of the ramp.
      (Game artists call this <i>half Lambert</i>, and SakuraRabbit's Unity shader uses it too.)</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Utilities</b> → <b>Math</b> → <b>Math</b>, set to <b>Multiply Add</b>. Set Multiplier <code>0.5</code>, Addend <code>0.5</code>.</li>
        <li>Wire Dot Product <b>Value</b> → its first <b>Value</b> input. (Optional: press <kbd>F2</kbd> and rename it \"x 0.5 + 0.5\" so you remember what it does.)</li>
      </ol>`)}
      ${shot('s3_remap', 'Dot Product · Value → Math (Multiply Add, 0.5, 0.5).')}
      <p>In the 3D view: the old black line at 90° is now mid-grey, and the back is a smooth gradient to black instead of all one value.</p>
    `),
    sec({ mode: 'toon3', stage: 'ramp', pink: false, label: 'Remapped → Color Ramp (stop 0.575), white sun only' }, `
      <h2>3.4 Snap it again</h2>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Color Ramp</b>, <b>Constant</b>, grey stop <code>0.363</code> at 0, white stop at <b>0.575</b>.</li>
        <li>Wire the Multiply Add <b>Value</b> → Color Ramp <b>Fac</b>.</li>
      </ol>`)}
      ${shot('s3_ramp', 'Multiply Add · Value → Color Ramp · Fac (Constant, white stop at 0.575).')}
      ${box('why', 'Why 0.575 now, not 0.15?', `
        <p>We want the <i>same</i> shadow edge as step 2: the place where cos(angle) = 0.15. But we squeezed the scale, so 0.15 moved:
        0.15 × 0.5 + 0.5 = <b>0.575</b>. Same edge, new address. You can confirm it in the 3D view: the edge sits where it did in step 2.</p>`)}
      <p>This is one important difference from step 2. The body no longer casts shadows onto itself. Look under the arm or at the sweater's inner edges.
      Our math only asks \"which way does the surface face?\" and never \"can it actually see the light?\". (I checked in EEVEE: putting a blocker
      in front of the sun changes nothing in this tree.) The floor still shows the shadow because the floor still uses a Diffuse BSDF.
      Step 5 brings cast shadows back on purpose, with the <i>Shadow Raycast</i> node.</p>
    `),
    sec({ mode: 'toon3', stage: 'tint', pink: false, label: 'Color Ramp × the current light\'s colour' }, `
      <h2>3.5 Each light paints its own colour: Light Info</h2>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Input</b> → <b>Light Info</b>.</li>
        <li>Add a <b>Mix Color</b> set to <b>Multiply</b>, Factor <code>1</code>. Wire Color Ramp <b>Color</b> → <b>A</b>, Light Info <b>Color</b> → <b>B</b>.</li>
      </ol>`)}
      ${shot('s3_lightcolor', 'Color Ramp → Mix A, Light Info · Color → Mix B (Multiply).')}
      <p><b>Light Info</b>, like Light Evaluation, describes the lamp currently being processed. Its <b>Color</b> is that lamp's colour, just the colour,
      not its strength. So for the white sun this changes nothing, and for the pink sun the bands come out pink.
      Brightness is now set by the ramp's colours, not by lamp strength.</p>
    `),
    sec({ mode: 'toon3', stage: 'final', pink: false, label: 'Light Accumulation: per-light toon × texture', ...REF }, `
      <h2>3.6 Add up all lights: Light Accumulation</h2>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Shader</b> → <b>Light Accumulation</b>.</li>
        <li>Wire Mix <b>Result</b> → <b>Diffuse Light</b>. This is the per-light part, run once per lamp.</li>
        <li>Add an <b>Image Texture</b> (body_Color.png) and wire its <b>Color</b> → <b>Diffuse Color</b>.</li>
        <li>Set <b>Glossy Color</b> and <b>Transmission Color</b> to black.</li>
        <li>Wire Light Accumulation <b>Shader</b> → Material Output <b>Surface</b>. Do the same in the Sweater material.</li>
      </ol>`)}
      ${shot('s3_accumulate', 'The finished step-3 tree. Everything left of Light Accumulation\'s Diffuse Light runs once per lamp.')}
      <p>What Light Accumulation computes is our familiar sentence, with the per-light part summed:</p>
      <p style=\"text-align:center\"><b>pixel = (toon light from lamp 1 + toon light from lamp 2 + …) × Diffuse Color</b></p>
      <p>That's \"light arriving × what the surface keeps\" again. The texture is multiplied <i>after</i> the lights are added,
      which is why it goes into its own <b>Diffuse Color</b> input and not into the per-light wiring.</p>
      ${box('why', 'Why set Glossy and Transmission Color to black?', `
        <p>Light Accumulation has two more slots: Glossy (shiny reflections) and Transmission (light passing through).
        Their Color inputs say how much of each reaches the pixel, and black means none. We only want our diffuse toon light, so both are off.</p>`)}
      ${shot('s3_viewport', 'Blender\'s viewport at the end of step 3.')}
      <p>Turn on <b>Compare with Blender render</b>: the bands match EEVEE.</p>
    `),
    sec({ mode: 'toon3', stage: 'final', pink: true, label: 'Step 3 tree with both suns: each paints its own bands', ...REF }, `
      <h2>3.7 Now try two lights again</h2>
      <p>Unhide the <b>Pink Sun</b> in <code>step3.blend</code>. In the 3D view it's switched on for you. Compare with step 2's two-sun picture:</p>
      <ul>
        <li>The pink sun makes its <b>own</b> lit and shadow bands, on the side it shines on, in <b>pink</b>.</li>
        <li>Where both suns reach, their bands <b>add</b>: white + pink gives a brighter, pink-tinted white.</li>
        <li>Each light's band edges stay sharp, because each light was snapped <i>before</i> the adding.</li>
      </ul>
      ${box('why', 'What you should take away', `
        <p>The order of operations <i>is</i> the design. Step 2: add the lights, then snap. You get one band and lose the colours.
        Step 3: snap each light, then add. You get separate coloured bands. Almost every later choice is the same kind of question:
        <b>at which point in the chain do I make the decision?</b></p>
        <p>One problem is visible already. Adding lights makes bright areas pile up toward white, and with three strong spotlights that washes the image out.
        The Unity original doesn't add its lights. It keeps the <b>brightest</b> one at each pixel. We'll get there in step 9.</p>`)}
    `),
  ].join(''),
};
