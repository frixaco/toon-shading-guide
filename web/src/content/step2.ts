import { sec, shot, box, widget, s } from './kit';

const REF = { ref: 's2_toon', refPink: 's2_two' };

export const step2 = {
  title: 'Measure the light, then snap it',
  html: [
    sec({ mode: 'lambert', tex: true, label: 'Where we left off: smooth Lambert × texture', ref: 's1_sun' }, `
      <h2>2.1 What makes it look \"toon\"?</h2>
      <p>Look at anime or a comic. A face is usually painted with only <b>two tones</b>: a lit colour and a shadow colour, with a clean edge between them.
      There's no smooth fade. The artist still follows where the light is, so the shadow is on the side turned away from the lamp.
      But they <i>decide</i> the shadow colour instead of letting it fade to black.</p>
      <p>So the recipe is:</p>
      <ol>
        <li>Find out how much light reaches each point. Step 1 already does this, as the smooth gradient.</li>
        <li>Turn that gradient into a <b>yes/no answer</b>: is this point lit or in shadow?</li>
        <li>Paint \"yes\" with the lit colour and \"no\" with a shadow colour we pick.</li>
      </ol>
      <p>Step 2 needs the light amount as a <b>number</b> we can compare. The Diffuse BSDF doesn't give us one.</p>
    `),
    sec({ mode: 'measure', label: 'What Shader to RGB measures: white Diffuse BSDF lit by the sun' }, `
      <h2>2.2 Turn a rule into a number: Shader to RGB</h2>
      <p>Remember the green ${s('shader')} socket from step 1: it carries a <i>rule</i> (\"I'm matte, scatter light like Lambert says\"), not a value.
      Normally the renderer applies that rule at the very end, with all the lights, and you never see the number.
      Math nodes can't work on a rule, just as you can't add 2 to a recipe.</p>
      <p><b>Shader to RGB</b> says: <i>apply this rule now, with every light in the scene, and give me the colour you get</i>.
      Its output is a yellow ${s('color')} socket. It's a real value we can do anything with. (It only exists in EEVEE. Cycles can't do this.)</p>
      ${box('do', 'Do this (start the Skin tree fresh)', `<ol>
        <li>Delete everything except Material Output.</li>
        <li>Add a <b>Diffuse BSDF</b> and set its Color to <b>pure white</b> (V = 1).</li>
        <li><kbd>Shift A</kbd> → <b>Converter</b> → <b>Shader to RGB</b>. Wire Diffuse <b>BSDF</b> → Shader to RGB <b>Shader</b>.</li>
        <li>To <i>see</i> the measurement, temporarily drag Shader to RGB's <b>Color</b> straight into Material Output <b>Surface</b>.
          (Blender treats a colour plugged into Surface as a surface that glows with that colour.)</li>
      </ol>`)}
      ${shot('s2_measure', 'Diffuse BSDF (white) → Shader to RGB.')}
      ${box('why', 'Why a WHITE Diffuse, and why no texture here?', `
        <p>We want to measure <b>only the light</b>. A white surface keeps 100% of it, so the output equals \"light arriving\" exactly:
        1.0 facing the sun, cos(angle) elsewhere, 0 on the dark side. Plug the texture in here and the measurement would mix in the skin colour,
        so dark skin would count as \"less lit\". We multiply by the texture later, once the light decision is already made.</p>`)}
      <p>The 3D view shows this measurement: the same smooth gradient as step 1, now in white, with the cast shadows included.
      Shader to RGB applies the whole rule, including the \"is something blocking the sun?\" test.</p>
    `),
    sec({ mode: 'toon2', stage: 'ramp', pink: false, label: 'Measurement → Color Ramp (Constant): two tones' }, `
      <h2>2.3 Snap it: Color Ramp set to Constant</h2>
      <p>A <b>Color Ramp</b> is a lookup table. You give it a number from 0 to 1 (<b>Fac</b>), it finds that spot on its colour bar,
      and it gives back the colour there. Normally it blends smoothly between its stops. With interpolation set to <b>Constant</b> it doesn't blend at all.
      Each stop's colour holds until the next stop. That's a staircase, and a two-step staircase is exactly our yes/no.</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Converter</b> → <b>Color Ramp</b>. Wire Shader to RGB <b>Color</b> → Color Ramp <b>Fac</b>.</li>
        <li>Change the interpolation dropdown from <i>Linear</i> to <b>Constant</b>.</li>
        <li>Click the left stop (position 0) and set its colour to grey: in the colour picker switch to the <b>RGB</b> tab and type <code>0.363</code> into R, G and B.
          (Use the RGB tab, not HSV or Hex. RGB fields are the linear numbers the renderer uses, while Hex and V are screen-curved.)</li>
        <li>Click the right stop (white) and set <b>Pos</b> to <code>0.15</code>.</li>
      </ol>`)}
      ${shot('s2_ramp', 'Shader to RGB · Color → Color Ramp · Fac. Constant interpolation; grey stop at 0, white stop at 0.15.')}
      ${widget('ramp')}
      ${box('num', 'A colour plugged into a number socket', `
        <p>Fac is grey ${s('float')}, one number, but we plugged in a yellow ${s('color')} three-number colour. Blender converts it automatically using
        <b>brightness as your eye sees it</b>: 21% of red + 72% of green + 7% of blue. (I measured this in Blender: a pink light
        (1, 0.35, 0.65) at half strength gave 0.255, matching that formula exactly.) Keep this in mind for section 2.6.</p>`)}
      ${box('why', 'Why the stop at 0.15?', `
        <p>The measurement is cos(angle). 0.15 is cos(81°). So \"lit\" means \"turned less than 81° away from the sun\", which is almost the whole side facing it.
        The lit side is generous, and only surfaces close to edge-on with the light fall into shadow. Drag <i>Ramp stop</i> under the 3D view.
        Toward 1 the shadow eats the body, toward 0 it shrinks to the far side. Where you put it is an art decision. 0.15 is the one that matches the Unity original.</p>`)}
      ${box('why', 'Why grey 0.363 instead of black?', `
        <p>The shadow side isn't \"no light\". It's \"less light\". In a real room, bounced light always fills shadows a bit, and painters never shade skin with black.
        0.363 is the exact shadow value SakuraRabbit's Unity material uses. In step 4 it becomes the low end of a continuous dial instead of one of two fixed values.</p>`)}
      <p>Look at the 3D view: <b>two flat tones</b>, with a clean edge exactly where the smooth gradient used to cross 0.15. The cast shadows also turned into flat grey,
      since they made the measurement 0, and 0 is below 0.15.</p>
    `),
    sec({ mode: 'toon2', stage: 'final', pink: false, label: 'Two tones × texture', ...REF }, `
      <h2>2.4 Bring the colours back: Mix → Multiply</h2>
      <p>Same sentence as always: <b>pixel = light arriving × what the surface keeps</b>. Our ramp now plays \"light arriving\"
      (1 or 0.363), and the texture plays \"what the surface keeps\". So we multiply them.</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Color</b> → <b>Mix Color</b>. Set its blend mode to <b>Multiply</b> and <b>Factor</b> to <code>1</code>.</li>
        <li>Wire Color Ramp <b>Color</b> → Mix <b>A</b>.</li>
        <li>Add an <b>Image Texture</b> (body_Color.png). Wire its <b>Color</b> → Mix <b>B</b>.</li>
      </ol>`)}
      ${shot('s2_texture', 'Color Ramp → Mix A, Image Texture → Mix B, blend mode Multiply.')}
      ${box('num', 'The Mix node in one line', `
        <p>Result = A blended toward (A <i>blend-mode</i> B) by Factor. With Factor 1 it's just the blend: here <b>A × B</b>, channel by channel.
        With Factor 0.5 you'd get halfway between A and A × B. Keep it at 1. (Leave <i>Clamp Result</i> off. It would cut off any value above 1.)</p>`)}
    `),
    sec({ mode: 'toon2', stage: 'final', pink: false, label: 'Two tones × texture, shown through Emission', ...REF }, `
      <h2>2.5 Show it exactly: Emission</h2>
      <p>We've already calculated the final colour of every pixel. We just need the renderer to <b>show it without touching it</b>.</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Shader</b> → <b>Emission</b>. Strength <code>1</code>.</li>
        <li>Wire Mix <b>Result</b> → Emission <b>Color</b>, then Emission → Material Output <b>Surface</b>.</li>
        <li>Rebuild the same chain in the <b>Sweater</b> material with Sweater_Color.jpg.</li>
      </ol>`)}
      ${shot('s2_emission', 'Mix · Result → Emission · Color → Material Output · Surface. The finished step-2 tree.')}
      ${box('why', 'Why Emission and not, say, a Diffuse BSDF?', `
        <p>A Diffuse BSDF would light our colour <b>again</b>: our flat tones × the smooth Lambert gradient. The smooth shading we just removed would come back on top.
        <b>Emission</b> means \"this surface glows with exactly this colour\". Lamps don't affect it, and with strength 1 the pixel is exactly the number we computed.
        All the lighting has already happened inside Shader to RGB, which still reacts to the sun. Emission just shows the result.</p>`)}
      ${shot('s2_viewport', 'Blender\'s viewport at the end of step 2.')}
      <p>Turn on <b>Compare with Blender render</b>: the bands match EEVEE.</p>
    `),
    sec({ mode: 'toon2', stage: 'final', pink: true, label: 'Step 2 tree with a second, pink sun added', ...REF }, `
      <h2>2.6 The catch: add a second light</h2>
      <p>The Unity scene has three coloured lights. So try a second sun: pink (1, 0.35, 0.65), strength π, coming from the other side
      (rotation X <code>71.2</code>, Y <code>0</code>, Z <code>119.1</code>). It's already in <code>step2.blend</code>, hidden: unhide \"Pink Sun\".
      In the 3D view, <b>Pink sun</b> is now ticked.</p>
      <p>Look closely. The <b>floor</b> turned pink, because it still uses a plain Diffuse BSDF and simply reflects whatever light arrives.
      The <b>body</b> didn't turn pink at all. Its lit area just <b>grew</b>, and grey shadow is left only where neither sun reaches. Two reasons:</p>
      <ol>
        <li><b>Shader to RGB adds all lights into one measurement.</b> After the addition, the node tree can't tell \"lit by the white sun\" from \"lit by the pink sun\".</li>
        <li><b>The colour is squashed into one number</b> when it enters Fac (21% red + 72% green + 7% blue, see 2.3). The pinkness is gone before the ramp sees it.
          The ramp then paints its own white or grey.</li>
      </ol>
      ${box('why', 'The lesson', `
        <p>Shader to RGB gives you <i>one</i> number for <i>all</i> light. That's fine for one white light. But our target needs
        every light to make its own bands, in its own colour. For that we need to do the shading math <b>separately for each light</b>, and that's step 3.</p>`)}
    `),
  ].join(''),
};
