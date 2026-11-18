import { sec, shot, box, img } from './kit';

const REF = { ref: 's6_toon', refPink: 's6_two' };

export const step6 = {
  title: 'Matcap: paint baked onto a sphere',
  html: [
    sec({ mode: 'toon', lv: 51, pink: false, label: 'Step 5: lighting is right, but the skin is flat between the bands' }, `
      <h2>6.1 What's still missing</h2>
      <p>Inside the lit band the skin is one flat colour, apart from what's painted in the texture. Unity's version has a gentle
      darkening toward the edges of every form and a soft warm glow in the middle. It looks like light wrapping around a rounded thing.</p>
      <p>We could build that out of more lights. A cheaper trick exists, and it's old: draw the look once, on a picture of a sphere, and reuse it everywhere.</p>
    `),
    sec({ mode: 'toon', lv: 61, show: 'matcap', knob: 'matcap', pink: false, label: 'The matcap factor alone: lerp(white, matcap, 0.598)' }, `
      <h2>6.2 The idea: a sphere already has every direction</h2>
      <p>Look at a ball. Every point on its visible half faces a different direction, and every direction that faces you appears exactly once.
      So a painted picture of a ball is a <b>lookup table from \"direction the surface faces\" to \"colour\"</b>.
      That's a <b>matcap</b> (material capture). SakuraRabbit's is <code>spheremapSkin.psd</code>:</p>
      ${img('/assets/matcap.png', 'spheremapSkin.psd: pale in the middle, warmer and darker toward the rim.', 'narrow')}
      <p>To use it, for each pixel: take the surface normal, find the point on the ball that faces the same way, read the colour there.</p>
      <h3>Finding the point on the ball</h3>
      <p>The direction must be measured <b>relative to the camera</b>, because the picture is of a ball seen from the front.
      In camera space, x points right, y up, z toward the viewer. A unit sphere's point with normal (x, y, z) is at position (x, y, z),
      and seen from the front it appears at screen position (x, y), each in −1 … 1. The image's UV coordinates run 0 … 1, so:</p>
      <p style="text-align:center;font-size:18px"><b>uv = normal<sub>camera</sub>.xy × 0.5 + 0.5</b></p>
      <p>It's the same −1…1 → 0…1 squeeze as the half Lambert in step 3, applied to two coordinates.</p>
      ${box('do', 'Do this (Skin and Sweater)', `<ol>
        <li><kbd>Shift A</kbd> → <b>Converter</b> → <b>Vector Transform</b>. Type <b>Vector</b>, From <b>World</b>, To <b>Camera</b>.
          Wire Geometry <b>Normal</b> → its <b>Vector</b>.</li>
        <li>Add a <b>Vector Math</b>, <b>Multiply Add</b>. Multiplier <code>(0.5, 0.5, 0)</code>, Addend <code>(0.5, 0.5, 0)</code>.
          Wire the Vector Transform output → its first Vector.</li>
      </ol>`)}
      ${shot('s6_uv', 'Geometry · Normal → Vector Transform (World → Camera) → Multiply Add (0.5, 0.5, 0).')}
      ${box('why', 'Why type \"Vector\" and not \"Point\" or \"Normal\"?', `
        <p>A <i>point</i> has a location, so converting it to camera space also subtracts the camera's position. A direction has no location; only rotation applies.
        <b>Vector</b> does rotation only. (<b>Normal</b> is the rule for normals under non-uniform scaling. With a camera there is no scaling, so both give the same result here.)
        Setting the z parts to 0 just throws z away: an image only has two coordinates.</p>`)}
      ${box('do', 'Then look it up', `<ol>
        <li>Add an <b>Image Texture</b>, open <code>spheremapSkin.psd</code>. Wire the Multiply Add <b>Vector</b> → its <b>Vector</b> input.</li>
        <li>Add a <b>Mix Color</b>, blend <b>Mix</b>, Factor <code>0.598</code>, <b>A</b> white. Wire the matcap <b>Color</b> → <b>B</b>.</li>
      </ol>`)}
      ${shot('s6_lookup', 'Matcap UV → Image Texture (spheremapSkin) → Mix (white → matcap, 0.598).')}
      <p>The Mix is Unity's <b>matcap intensity 0.598</b>: lerp(white, matcap, 0.598) gives 40% of \"no change\" and 60% of the matcap.
      The 3D view shows this factor. Orbit it: the factor doesn't stick to the skin, it stays fixed relative to the <i>view</i>.
      That's correct, because it's computed from camera-space normals.</p>
    `),
    sec({ mode: 'toon', lv: 61, knob: 'matcap', pink: false, label: 'Step 6 result: albedo = texture × matcap factor', ...REF }, `
      <h2>6.3 It modifies the surface, not the light</h2>
      <p>Where does it go: the light side or the surface side of pixel = light × surface? Unity multiplies it into the <b>albedo</b>,
      the surface colour, before any lighting. So it acts as if the paint itself were darker toward the edges.
      Consequence: it shows in lit <i>and</i> shadowed areas, and every light sees it.</p>
      ${box('do', 'Do this', `<ol>
        <li>Add a <b>Mix Color</b>, <b>Multiply</b>, Factor 1. Body texture <b>Color</b> → <b>A</b>, matcap Mix <b>Result</b> → <b>B</b>. Rename it \"albedo\".</li>
        <li>Wire its <b>Result</b> → Light Accumulation <b>Diffuse Color</b>, replacing the plain texture.</li>
      </ol>`)}
      ${shot('s6_albedo', 'The step-6 tree. Bottom row: texture × matcap = albedo, into Diffuse Color.')}
      ${box('warn', 'A matcap is a fake, and it has a price', `
        <p>It depends only on the normal relative to the camera, never on the lights. Move a light and the matcap doesn't move; turn the camera and it slides across the skin.
        That's fine for a soft fill effect, which is how it's used here (60% strength, multiplied). Don't use a matcap for anything that should follow a light.</p>`)}
      <p>Compare: the edges of the breasts, shoulders and thighs now darken gently. Slide <b>Matcap strength</b> to 0 and 1 to see what it contributes.</p>
      ${shot('s6_viewport', 'Blender\'s viewport at the end of step 6.')}
    `),
  ].join(''),
};
