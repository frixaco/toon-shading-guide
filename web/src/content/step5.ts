import { sec, shot, box } from './kit';

const REF = { ref: 's5_toon', refPink: 's5_two' };

export const step5 = {
  title: 'Cast shadows: facing × seeing',
  html: [
    sec({ mode: 'toon', lv: 42, pink: false, label: 'Step 4: the arm faces the sun, so it is lit, even where the body blocks it', ...REF, ref: 's4_toon', refPink: 's4_two' }, `
      <h2>5.1 Two different questions</h2>
      <p>Whether a point is lit depends on two independent facts:</p>
      <ol>
        <li><b>Facing:</b> does the surface turn toward the light? That's N·L, a property of the point alone.</li>
        <li><b>Seeing:</b> is there a clear straight line from the point to the light? That depends on <i>everything else in the scene</i>.</li>
      </ol>
      <p>Our tree only asks question 1. Physically, light arrives only if both are true, so the honest combination is a logical AND.
      For values between 0 and 1, AND is <b>multiplication</b>: 1 × 1 = 1, anything × 0 = 0, and partial values combine sensibly.</p>
      <p>Look at the inside of the arm and the side of the body under it in the 3D view. They face the sun, so they're lit, but the arm is in the way. That's what we fix.</p>
    `),
    sec({ mode: 'toon', lv: 51, show: 'vis', pink: false, label: 'Seeing: smoothstep(0, 1, shadow) for the white sun. Black = something blocks the light' }, `
      <h2>5.2 Asking \"can I see the light?\": Shadow Raycast</h2>
      <p>The only way to answer question 2 is to look: shoot a ray from the point toward the light and check whether it hits anything first.
      EEVEE does that with its shadow maps, and Blender 5 exposes the result to node trees as <b>Shadow Raycast</b>.
      Like Light Evaluation, it only means something inside Light Accumulation, because \"the light\" is the lamp currently being processed.
      Its <b>Color</b> output is 1 where the light is visible and 0 where it's blocked, with soft values at penumbra edges.</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd>, type <i>Shadow Raycast</i>, <kbd>Enter</kbd>. Set <b>Softness</b> to <code>0</code>.</li>
        <li>Add a <b>Map Range</b>, <b>Smooth Step</b>, From Min <code>0</code>, From Max <code>1</code>. Wire Shadow Raycast <b>Color</b> → its <b>Value</b>.</li>
      </ol>`)}
      ${shot('s5_raycast', 'Shadow Raycast · Color → Map Range (Smooth Step, 0 … 1).')}
      ${box('why', 'Why a smoothstep from 0 to 1? It doesn\'t change the end points', `
        <p>Right, at 0 and 1 it does nothing. It only reshapes the penumbra: a shadow edge that fades linearly gets the same S-curve we gave the
        shading edge in step 4, so both kinds of edge look alike. Unity's code is <code>smoothstep(lerp(0, 0.6, h), lerp(1, 0.6, h), shadow)</code>
        with shadow hardness <i>h</i> = 0, which is exactly smoothstep(0, 1, ·). Raising <i>h</i> would squeeze the interval toward 0.6 and sharpen the edge.</p>`)}
      ${box('num', 'Why Softness 0?', `
        <p>The node's Softness widens the shadow by sampling the light as a larger disc. The Unity original uses ordinary hard shadow maps,
        and the lamps themselves already have a small radius (step 8), so we let the light's own size decide.</p>`)}
    `),
    sec({ mode: 'toon', lv: 51, pink: false, label: 'Step 5 result: cast shadows are back, using the same shadow tone', ...REF }, `
      <h2>5.3 AND them together, before the strength dial</h2>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Math</b> node, <b>Multiply</b>. Rename it \"facing × seeing\".</li>
        <li>Wire the soft edge Map Range <b>Result</b> → its first input, the Shadow Raycast Map Range <b>Result</b> → its second.</li>
        <li>Wire its <b>Value</b> → Shadow Strength's first <b>Value</b>, replacing the wire from the soft edge.</li>
      </ol>`)}
      ${shot('s5_combine', 'soft edge × smoothstep(shadow) → Shadow Strength. Everything after it is unchanged.')}
      ${box('why', 'Why multiply here, and not at the end?', `
        <p>Same lesson as step 3: <b>where</b> you put the decision is the design. Multiplying before Shadow Strength means a cast shadow is just
        \"more shadow\": it goes through the same 0.942 dial and lands on the same 0.363 tone. A self-shadow and a cast shadow are indistinguishable,
        which is what a painter would do. If you multiplied the final colour instead, cast shadows would go to black.</p>
        <p>This is <code>shade = lerp(1, cel × shadowTerm, 0.942)</code> in Unity's <code>ToonShadeOneLight</code>, term by term.</p>`)}
      <p>Turn on Compare. The shadow under the arm and on the inner thighs now matches EEVEE. Edges differ a little, because the browser computes
      shadows with a cheaper shadow map than EEVEE's.</p>
      ${shot('s5_viewport', 'Blender\'s viewport at the end of step 5.')}
    `),
  ].join(''),
};
