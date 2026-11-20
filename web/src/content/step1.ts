import { sec, shot, box, widget, s } from './kit';

const REF = { ref: 's1_sun' };

export const step1 = {
  title: 'One sun, one matte surface',
  html: [
    sec({ mode: 'black', label: 'World set to black: nothing lights the scene' }, `
      <h2>1.1 Turn off the sky</h2>
      <p>Last step showed that light coming equally from every direction gives no shape. So we remove it.
      We want <b>one</b> light we control completely, so every brightness on the model has a reason we can name.</p>
      ${box('do', 'Do this', `<ol>
        <li>Open the <b>World</b> tab in the Properties editor (the red globe icon).</li>
        <li>Set <b>Color</b> to pure black (V = 0). Keep Strength at 1. Black times anything is still black.</li>
      </ol>`)}
      ${shot('s1_world', 'World tab: Background colour set to black.', 'narrow')}
      <p>The 3D view is now pitch black. That's expected. A scene without light has nothing to send to the camera.</p>
      ${box('why', 'Why bother, when the default grey was so dim?', `
        <p>The world's light is <b>added</b> to everything. In step 2 we'll measure the light on the surface and make decisions from that number,
        like \"above 0.15 counts as lit\". Any extra light from the sky shifts every measurement up a little, and that moves where our decisions land.
        I checked: a white world at strength 1 adds +0.8 to every measurement. Black world means the measurement is the sun and nothing else.</p>`)}
    `),
    sec({ mode: 'black', label: 'World set to black: nothing lights the scene' }, `
      <h2>1.2 Show numbers as they are</h2>
      <p>The renderer works with <i>linear</i> amounts of light (see step 0). Your screen doesn't, so Blender has to convert them.
      The <b>View Transform</b> picks how.</p>
      ${box('do', 'Do this', `<ol>
        <li>Open the <b>Render</b> tab (the camera-back icon) and expand <b>Color Management</b>.</li>
        <li>Change <b>View</b> from <i>AgX</i> to <b>Standard</b>.</li>
      </ol>`)}
      ${shot('s1_viewtransform', 'Render tab → Color Management → View: Standard.', 'narrow')}
      ${box('why', 'Why Standard and not the default AgX?', `
        <p>AgX is a <i>film look</i>. It squeezes bright values so they never clip to pure white, and it washes out strong colours as they get brighter.
        That's lovely for photoreal renders. For us it's a problem: we're going to <b>design</b> exact colours, like \"shadow is 0.363 grey\".
        AgX would quietly change them before they reach your eyes.</p>
        <p><b>Standard</b> does only the unavoidable part: the sRGB curve every screen expects. Linear 1.0 shows as white, 0 as black,
        and nothing gets tinted. (The Unity original ends with a film look too, called ACES. We add it on purpose in the last step, once the design is done.)</p>`)}
    `),
    sec({ mode: 'lambert', tex: false, label: 'One sun, default Diffuse BSDF (grey 0.8)' }, `
      <h2>1.3 Add a sun</h2>
      ${box('do', 'Do this', `<ol>
        <li>In the 3D viewport: <kbd>Shift A</kbd> → <b>Light</b> → <b>Sun</b>.</li>
        <li>Press <kbd>N</kbd> to open the side panel. Under <b>Rotation</b>, type X <code>52.3</code>, Y <code>0</code>, Z <code>-34.5</code>.</li>
        <li>In the Light tab (green bulb icon), set <b>Strength</b> to <code>3.142</code> and <b>Angle</b> to <code>0.5°</code>.</li>
      </ol>`)}
      ${shot('s1_sunprops', 'The Sun\'s Light properties: Strength 3.142 (that\'s π), Angle 0.5°.', 'narrow')}
      ${box('why', 'Why only rotation, and not where the sun is?', `
        <p>A Sun lamp acts like the real sun: it's so far away that its rays arrive <b>parallel</b>, all from the same direction, everywhere in the scene.
        Moving it changes nothing. Only its rotation (which way the rays travel) matters. You can drag the dashed line in the viewport to aim it.</p>`)}
      ${box('why', 'Why strength π (3.142)?', `
        <p>A matte surface doesn't send light back only toward the camera. It scatters it in every direction over the half-dome above it.
        Blender accounts for that spreading, and the result is that a white surface facing a sun of strength 1 shows only 1/π ≈ 0.32.
        Using strength π cancels that out, so a white surface facing the sun comes out as exactly <b>1.0</b>.
        I measured it in Blender: 1.0 facing the sun, 0.5 at 60°. Now every number we see is a clean fraction.</p>`)}
      ${box('why', 'Why angle 0.5°?', `
        <p><b>Angle</b> is how big the sun looks in the sky. A big sun lights a point from slightly different directions, which blurs shadow edges.
        0.5° is about the real sun, so shadows stay crisp. Toon art wants crisp.</p>`)}
    `),
    sec({ mode: 'lambert', tex: false, label: 'One sun, default Diffuse BSDF (grey 0.8)' }, `
      <h2>1.4 A matte surface: Diffuse BSDF</h2>
      <p>The model still has the default material. We swap it for the simplest one there is.</p>
      ${box('do', 'Do this (Skin material)', `<ol>
        <li>Select <b>Body</b>, then switch to the <b>Shading</b> workspace (tab at the top), or turn any editor into a <b>Shader Editor</b>.</li>
        <li>Click the <b>Principled BSDF</b> node and press <kbd>X</kbd> to delete it.</li>
        <li><kbd>Shift A</kbd> → <b>Shader</b> → <b>Diffuse BSDF</b>.</li>
        <li>Drag from its green <b>BSDF</b> ${s('shader')} dot to the <b>Surface</b> ${s('shader')} dot of <b>Material Output</b>.</li>
      </ol>`)}
      ${shot('s1_diffuse', 'Diffuse BSDF → Material Output · Surface. The highlighted nodes are the ones this sub-step adds or changes.')}
      ${box('num', 'Socket colours: what travels on a wire', `
        <p>The dot's colour tells you what kind of data the wire carries. You'll see all four in this guide:</p>
        <table>
          <tr><td>${s('color')} yellow</td><td>a colour: three numbers, red, green and blue</td></tr>
          <tr><td>${s('float')} grey</td><td>one plain number</td></tr>
          <tr><td>${s('vector')} purple</td><td>a direction or position: three numbers, x, y and z</td></tr>
          <tr><td>${s('shader')} green</td><td>a <b>shader</b>: not a value, but a <i>rule</i> for what happens when light hits the surface</td></tr>
        </table>
        <p>Remember the green one. In step 2 we'll need to turn a rule into a number.</p>`)}
      <h3>What does \"Diffuse\" mean?</h3>
      <p>It means a perfectly matte surface, like chalk or paper. It has no shine, and it looks the same from every viewing angle.
      It follows the oldest rule of shading, <b>Lambert's law</b>: brightness depends only on how directly the surface faces the light.
      Play with this:</p>
      ${widget('lambert')}
      <p>The key is what a pixel's brightness measures: <b>how much light lands on that one small bit of surface</b>, not how much light there is in total.
      Light is a stream of energy, like rain. Hold a tray flat under vertical rain and it fills at some rate. Tilt the tray and fewer drops land in it per second,
      even though it's the same tray in the same rain: tilted, it presents a smaller target to the falling drops. No drop is lost or bounced away; they just land elsewhere.</p>
      <p>The widget does the same with light. The beam is 8 rays, each carrying the same amount, and the surface is cut into tiles.
      Facing the light, the 8 rays land on 4 tiles: 2 rays per tile. Tilt it to <b>60°</b> and the same 8 rays land on <b>8 tiles</b>: 1 ray per tile.
      Each tile, so each pixel looking at it, gets <b>half</b> as much. That's the 0.5. It's not "0.5 less"; it's "0.5 of the head-on amount".</p>
      <p>Why exactly cos(angle)? Look at the pink dashed line: it's the beam's own width, drawn across the rays. It and the footprint on the surface form a right triangle
      with the tilt angle at the corner. The footprint is the long side, so footprint = beam width / cos(angle). At 60°, cos is 0.5, so the footprint is twice the beam width,
      and the light per tile is 1 / 2. At 0° it's 1 (all of it), and at 90° (grazing) the footprint is endless and each tile gets 0.
      Past 90° the light hits the other side of the surface, so this side gets 0.</p>
      <p>Two things are <i>not</i> involved: refraction (light bending as it passes into glass or water) and reflection off the top layer.
      All the light that arrives is accounted for; the dimming is purely that it arrives spread over more area.</p>
      <p>Look at the 3D view: the model finally has <b>shape</b>. Brightness now depends on direction. The shoulder facing the sun is bright,
      and the side turned away fades smoothly into black. Drag <i>Sun turn</i> and <i>height</i> under the view and watch the bright side follow the sun.</p>
      ${box('why', 'Why is the dark side completely black?', `
        <p>Because the sun is the <b>only</b> light, and the dark side faces away from it. In real life the room and the sky would bounce some light in.
        We removed all of that on purpose. That pure black is the thing toon shading will fix next, by deciding on a shadow tone ourselves.</p>`)}
      <p>The model also casts a <b>shadow</b> on the floor and on itself. That isn't part of Lambert's law. It's a separate test the renderer does:
      \"can this point see the sun at all, or is something in the way?\" Remember there are two separate things, <i>facing</i> the light and <i>seeing</i> it.
      Toon shaders often treat them differently.</p>
    `),
    sec({ mode: 'lambert', tex: true, label: 'Diffuse BSDF × skin texture, one sun', ...REF }, `
      <h2>1.5 Give it its colours: Image Texture</h2>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> → <b>Texture</b> → <b>Image Texture</b>. Click <b>Open</b> and pick
          <code>body_Color.png</code> from <code>unity-sr\\blender\\textures\\</code>.</li>
        <li>Drag its yellow <b>Color</b> ${s('color')} into the Diffuse BSDF's <b>Color</b> ${s('color')}.</li>
        <li>Check <b>Color Space</b> says <b>sRGB</b>.</li>
        <li>Do the same in the <b>Sweater</b> material with <code>Sweater_Color.jpg</code>. The Floor already has a grey Diffuse BSDF.</li>
      </ol>`)}
      ${shot('s1_texture', 'Image Texture · Color → Diffuse BSDF · Color.')}
      <p>Remember: <b>pixel = light arriving × what the surface keeps</b>. Lambert's law supplies the first part, and the texture now supplies the second,
      the colour the surface keeps, which can be different at every point. That's why skin turns peachy and the sweater grey, but the shading is the same as before.</p>
      ${box('why', 'Why \"sRGB\" for Color Space?', `
        <p>Image files store values already curved for screens, the same sRGB curve that <i>Standard</i> applies on the way out.
        Setting the texture to sRGB tells Blender to undo that curve when it reads the file, so the renderer gets linear amounts.
        Later you'll meet textures that aren't colours at all, like normal maps that store directions. Those must be <i>Non-Color</i> so nothing gets un-curved.</p>`)}
      <p>Now turn on <b>Compare with Blender render</b> and drag the wipe. The browser and EEVEE agree, apart from the softness of shadow edges.</p>
      ${shot('s1_viewport', 'What Blender\'s viewport (Rendered, camera view) shows at the end of step 1.')}
      <p>That's realistic shading. In the next step we keep the measurement it makes but throw away the smoothness.</p>
    `),
  ].join(''),
};
