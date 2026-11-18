import { sec, shot, box, widget, s } from './kit';

const REF = { ref: 's4_toon', refPink: 's4_two' };

export const step4 = {
  title: 'A soft edge, and shadow as a dial',
  html: [
    sec({ mode: 'toon3', stage: 'final', pink: false, label: 'Where step 3 ended: a Constant ramp, a hard edge', ref: 's3_toon', refPink: 's3_two' }, `
      <h2>4.1 What's wrong with a perfectly hard edge</h2>
      <p>Zoom the 3D view in on the shadow line on the arm or the thigh. Two things are off:</p>
      <ul>
        <li><b>It's brittle.</b> A Constant ramp is a step function, so the edge sits exactly where N·L crosses one number.
          The normal is interpolated across triangles, and any small wobble in it moves that crossing. On a hard edge every wobble shows
          as a wiggle in the line, and when the light or the model moves the line pops from one triangle to the next.</li>
        <li><b>It reads as a cut-out, not as paint.</b> A painter's shadow edge has a <i>width</i>: a narrow band where one tone turns
          into the other. Unity's shader has exactly that, and it's controlled by one number, <b>hardness</b>.</li>
      </ul>
      <p>So we replace the step with a function that goes from 0 to 1 over a short interval instead of instantly.
      The question is <i>which</i> function.</p>
    `),
    sec({ mode: 'toon', lv: 42, show: 'cel', knob: 'hard', pink: false, label: 'The soft edge on its own: smoothstep of the remapped dot product (white sun)' }, `
      <h2>4.2 The shape of the edge: smoothstep</h2>
      <p>Call the input <i>x</i> (our remapped N·L, 0 … 1) and say the transition should happen between <i>a</i> and <i>b</i>.
      First rescale so the interval becomes 0 … 1: <i>t</i> = clamp((<i>x</i> − <i>a</i>) / (<i>b</i> − <i>a</i>), 0, 1).
      Now we need a curve <i>f</i>(<i>t</i>) with:</p>
      <ul>
        <li><i>f</i>(0) = 0 and <i>f</i>(1) = 1, so it meets the flat shadow and the flat lit tone;</li>
        <li><i>f</i>′(0) = 0 and <i>f</i>′(1) = 0, so it meets them <b>without a corner</b>.</li>
      </ul>
      <p>The straight line <i>f</i>(<i>t</i>) = <i>t</i> passes the first test and fails the second: it has a kink at both ends.
      Your visual system is a very good edge detector, and it sees a kink in brightness as an extra faint line (these are called Mach bands).
      Four conditions pin down a cubic exactly. Solving them gives</p>
      <p style="text-align:center;font-size:18px"><b><i>f</i>(<i>t</i>) = 3<i>t</i>² − 2<i>t</i>³</b></p>
      <p>That's <b>smoothstep</b>. It's the cheapest curve that blends two flat regions with no visible seam, which is why every shader language has it built in.
      Unity's toon shader uses it for the shadow edge, and Blender has it in the <b>Map Range</b> node.</p>
      ${widget('smooth')}
      ${box('do', 'Do this (Skin, then the same in Sweater)', `<ol>
        <li>Delete the <b>Color Ramp</b>.</li>
        <li><kbd>Shift A</kbd>, type <i>Map Range</i>, press <kbd>Enter</kbd>. Set its interpolation dropdown to <b>Smooth Step</b> and keep <b>Clamp</b> on.</li>
        <li><b>From Min</b> <code>0.518</code>, <b>From Max</b> <code>0.662</code>, To Min 0, To Max 1.</li>
        <li>Wire the Multiply Add (×0.5+0.5) <b>Value</b> → Map Range <b>Value</b>. Rename it \"soft edge\".</li>
      </ol>`)}
      ${shot('s4_edge', 'Remapped dot product → Map Range (Smooth Step, 0.518 … 0.662).')}
      ${box('num', 'Where 0.518 and 0.662 come from', `
        <p>Unity's material stores two artist knobs: <b>threshold 0.95</b> and <b>hardness 0.688</b>. Its code (<code>ToonCelShade</code>) turns them into</p>
        <p style="text-align:center">scale = lerp(7, <i>m</i>, <i>m</i>) with <i>m</i> = 2·0.95 − 1 = 0.9 → scale = 1.51<br>
        edge = lerp(0.3, 1, 0.688) = 0.7816<br>
        cel = smoothstep(0.7816, 1, <i>x</i> × 1.51)</p>
        <p>Multiplying <i>x</i> by 1.51 and then asking for 0.7816 … 1 is the same as asking <i>x</i> for 0.7816/1.51 … 1/1.51 = <b>0.518 … 0.662</b>.
        We divide once, offline, instead of multiplying in every pixel.</p>
        <p>In angles: <i>x</i> = 0.518 is N·L = 0.035 (88° from the light) and <i>x</i> = 0.662 is N·L = 0.32 (71°).
        So the edge sits <b>just before the true terminator</b>, and the softening happens over about 17° of surface turn.
        Hardness only moves the 88° end. At hardness 1 both ends meet and you're back to a hard step.</p>`)}
      <p>The 3D view shows the Map Range output for the white sun. Drag <b>Hardness</b> under it and watch the band widen or collapse.</p>
    `),
    sec({ mode: 'toon', lv: 42, show: 'shade', knob: 'hard', pink: false, label: 'shade = edge × 0.942 + 0.058: the dark side never reaches 0' }, `
      <h2>4.3 How dark is dark? Shadow strength</h2>
      <p>The edge gives 0 in shadow and 1 in light. Unity doesn't use it directly. It first applies <b>self-shadow intensity 0.942</b>:</p>
      <p style="text-align:center"><b>shade = lerp(1, edge, 0.942) = edge × 0.942 + 0.058</b></p>
      <p>Read lerp(1, edge, <i>k</i>) as \"how much of the shadow to believe\". At <i>k</i> = 1 shadow is fully shadow; at <i>k</i> = 0 the shadow is switched off.
      0.942 means: believe it 94.2%, so even the deepest shadow keeps 5.8% of the lit look.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Math</b> node, <b>Multiply Add</b>, Multiplier <code>0.942</code>, Addend <code>0.058</code>.</li>
        <li>Wire Map Range <b>Result</b> → its first <b>Value</b>. Rename it \"shadow strength\".</li>
      </ol>`)}
      ${shot('s4_strength', 'Map Range → Math (Multiply Add, 0.942, 0.058).')}
      <p>Why a separate knob when you could just lighten the shadow colour? Because it's applied <i>before</i> the colour step,
      it also weakens <b>cast shadows</b> (step 5) and the <b>rim light</b> mask (step 10) by the same amount. One dial, used everywhere shade is used.</p>
    `),
    sec({ mode: 'toon', lv: 42, knob: 'hard', pink: false, label: 'Step 4 result: smooth edge, shade blended from 0.363 to white', ...REF }, `
      <h2>4.4 From a 0…1 dial to a colour: Mix</h2>
      <p>The Color Ramp used to do two jobs at once: decide lit or shadow, <i>and</i> pick the two tones. Now the decision is a continuous number
      (shade, 0.058 … 1) and we need a straight map from it to a brightness: 0 → shadow tone, 1 → full light.
      That map is a <b>linear interpolation</b>, lerp(<i>A</i>, <i>B</i>, <i>f</i>) = <i>A</i> + (<i>B</i> − <i>A</i>)·<i>f</i>. In Blender it's the <b>Mix</b> node.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Mix</b> node and set its type dropdown to <b>Float</b>. <b>A</b> <code>0.363</code>, <b>B</b> <code>1</code>.</li>
        <li>Wire Shadow Strength <b>Value</b> → Mix <b>Factor</b>.</li>
        <li>Wire Mix <b>Result</b> ${s('float')} → the colour Mix's <b>A</b> (the one that multiplies by Light Info Color). A grey number fed into a colour socket becomes that grey.</li>
      </ol>`)}
      ${shot('s4_tone', 'Shadow Strength → Mix Float (A 0.363, B 1) → × light colour. The rest of the step-3 tree is unchanged.')}
      ${box('num', 'The actual darkest value', `
        <p>The deepest shadow is shade = 0.058, so the tone is 0.363 + (1 − 0.363) × 0.058 = <b>0.400</b>, not 0.363. That's the 5.8% leak from 4.3, in numbers.</p>`)}
      ${box('why', 'Why some creases look shaded even in full light', `
        <p>Look at the armpits, the inner elbows, under the chest: they're a little darker and pinker even where the sun hits them.
        That isn't our shader. It's painted into <code>body_Color.png</code>. The artist painted soft crease shading straight into the skin colour.</p>
        <p>Remember pixel = light × surface. The texture is the surface factor, so painted shading is multiplied into every lighting condition.
        It's shading that <b>doesn't move with the light</b>. That's a deliberate toon trick: the moving lights draw the big shapes,
        and the painted detail stays as the artist drew it.</p>`)}
      <p>Turn on <b>Compare with Blender render</b>. The edge in the 3D view now matches the EEVEE render, softness included.
      Try the pink sun too: each sun still gets its own soft-edged band.</p>
      ${shot('s4_viewport', 'Blender\'s viewport at the end of step 4.')}
    `),
  ].join(''),
};
