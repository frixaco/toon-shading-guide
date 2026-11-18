import { sec, img, box } from './kit';

export const step0 = {
  title: 'A mesh in the dark',
  html: [
    sec({ mode: 'ambient', label: "Blender's default: dim grey world, no lamps", ref: 's0_dark' }, `
      <h2>Where we're going</h2>
      <p>This guide rebuilds the look of SakuraRabbit's <i>Toon Rain</i> in Blender: flat, painted-looking light and shadow,
      coloured lights, a thin outline and a soft camera finish. Below is the Unity original. By the last step you'll have
      the same 20+ node setup, and no node in it will be arbitrary: each one is the answer to a specific question about light, surfaces or images,
      derived from first principles where it's introduced. The goal is that you could rebuild it from a blank file without this page, and change it on purpose.</p>
      ${img('/goal/unity_final.png', 'The target: the Unity original (close-up). We start with a lot less.')}
      <p>We start from the opposite end: just the model, a camera and a floor, no lights, no materials worth mentioning.
      Every step adds <b>one idea</b>, and the 3D view on the right always shows what that idea does to the model.</p>
    `),
    sec({ mode: 'ambient', label: "Blender's default: dim grey world, no lamps", ref: 's0_dark' }, `
      <h2>How to use this page</h2>
      <ul>
        <li>The 3D view on the right follows the part you're reading. The part it's showing has a <b style="color:var(--accent)">yellow bar</b> on its left.</li>
        <li>Drag to orbit, right-drag to pan, scroll to zoom. <i>Reset view</i> puts the camera back where Blender's camera is.</li>
        <li><i>Compare with Blender render</i> lays the real Blender render from the same camera over the 3D view. Drag the slider to wipe between them.
          The point is that the browser is doing <b>the same math</b> as your node tree, so you can poke at that math live.
          (Shadow edges won't match exactly. The browser computes shadows a cheaper way than EEVEE does.)</li>
        <li>Each step has a finished <code>.blend</code> at the top. Open it if you get lost, or build along in your own file.</li>
        <li>Click any screenshot to see it full size.</li>
      </ul>
    `),
    sec({ mode: 'ambient', label: "Blender's default: dim grey world, no lamps", ref: 's0_dark' }, `
      <h2>What you start with</h2>
      <p>Open <code>step0.blend</code>. It has three objects:</p>
      <ul>
        <li><b>Body</b> and <b>Sweater</b>: the model. Each has its own material, called <code>Skin</code> and <code>Sweater</code>.</li>
        <li><b>Floor</b>: a curved backdrop, like the paper sweep in a photo studio. The floor bends up into a wall, so there's no horizon line behind the model.
          It's set to <b>not cast shadows</b> (Object properties → Visibility → Ray Visibility → Shadow unticked).
          It still <i>receives</i> shadows, but the wall can't block a light shining from behind it. We'll have one of those in step 2.</li>
      </ul>
      <p>There's also a camera. There's <b>no lamp</b>.</p>
      ${box('do', 'Do this in Blender', `<ol>
        <li>Hover the 3D viewport, press <kbd>Numpad 0</kbd> to look through the camera.</li>
        <li>Press <kbd>Z</kbd> and pick <b>Rendered</b>. You can also click the 4th sphere icon at the top right of the viewport.</li>
      </ol>`)}
      ${box('why', 'Why "Rendered" and not the other modes?', `
        <p>The viewport has four ways to draw. Only one uses <i>your</i> lighting:</p>
        <ul>
          <li><b>Solid</b>: a quick preview with a fake studio light. It ignores your materials completely.</li>
          <li><b>Material Preview</b>: shows your materials, but lit by a built-in photo of a room (an <i>HDRI</i>), not by your lamps.</li>
          <li><b>Rendered</b>: the real EEVEE result, using your lamps and your world. This is the final image.</li>
        </ul>
        <p>This whole guide is about designing light, so we always look at Rendered. If you look in Material Preview,
        you'll be judging light that isn't actually in your scene.</p>`)}
      <p>What you see is a flat grey silhouette on a darker grey background. It's the same in the 3D view on the right.
      To understand <i>why</i> it's flat, we need to know what a renderer actually computes.</p>
    `),
    sec({ mode: 'ambient', label: "Blender's default: dim grey world, no lamps", ref: 's0_dark' }, `
      <h2>What a renderer computes for each pixel</h2>
      <p>For every pixel, the renderer draws a line from the camera into the scene until it hits a surface. Then it asks two questions about that point:</p>
      <ol>
        <li><b>How much light arrives here?</b></li>
        <li><b>Of that light, how much does the surface keep and send back</b>, separately for red, green and blue?</li>
      </ol>
      <p>Then it multiplies the two answers. That gives the pixel:</p>
      <p style="text-align:center;font-size:18px"><b>pixel = light arriving × what the surface keeps</b></p>
      <p>Keep this sentence in mind. Almost every node we add later changes one side of that multiplication.</p>
      ${box('num', 'Numbers in Blender', `
        <p>Blender stores light as plain amounts. 0 means none. 1 means "full white". Values above 1 are allowed (very bright).
        Doubling the light doubles the number. These are called <b>linear</b> values.
        A surface colour is also a number between 0 and 1 for each channel: the fraction of red, green and blue light it keeps.
        Skin, for example, keeps a lot of red and less blue.</p>`)}
      <h3>So why is the model a flat silhouette?</h3>
      <p>Because the only light is the <b>world</b>, the "sky" around the whole scene. By default it's a dim grey (0.05) that shines
      <b>equally from every direction</b>. Every point on the body sees that same dim sky no matter which way it faces.
      So every point gets the same amount of light and comes out the same brightness.</p>
      ${box('why', 'The idea everything else builds on', `
        <p>Your eye reads <b>shape</b> from <b>brightness changing</b> across a surface. Brightness only changes if it
        <b>depends on which way the surface faces</b>. Light that comes equally from everywhere gives no differences, and no differences means no shape.</p>
        <p>Every shader in this guide is a different answer to one question: <i>how should brightness depend on the direction a surface faces?</i>
        Realistic shading gives a smooth answer. Toon shading gives a few flat steps.</p>`)}
    `),
    sec({ mode: 'ambient', label: "Blender's default: dim grey world, no lamps", ref: 's0_dark' }, `
      <h2>The road</h2>
      <table>
        <tr><th>Step</th><th>Idea</th></tr>
        <tr><td>1</td><td>One sun and a matte surface: how real light depends on direction.</td></tr>
        <tr><td>2</td><td>Measure that light, then snap it into two flat tones. This is the first toon look.</td></tr>
        <tr><td>3</td><td>Do the "how much does it face the light" math yourself, once per light.</td></tr>
        <tr><td>4</td><td>A soft edge (smoothstep) and a shadow-strength dial instead of a hard ramp.</td></tr>
        <tr><td>5</td><td>Cast shadows: \"facing\" × \"seeing\".</td></tr>
        <tr><td>6</td><td>Matcap: a lookup from view-space normal to colour.</td></tr>
        <tr><td>7</td><td>Outline: the inverted hull, built with Geometry Nodes.</td></tr>
        <tr><td>8</td><td>The real lights: three spotlights with HDRP's falloff.</td></tr>
        <tr><td>9</td><td>Brightest light wins: cap, max in the compositor, saturation.</td></tr>
        <tr><td>10</td><td>The sweater: a hand-decoded normal map and a rim light.</td></tr>
        <tr><td>11</td><td>The Unity camera, height fog, depth of field.</td></tr>
        <tr><td>12</td><td>AO tint, vignette, colour grade, ACES.</td></tr>
      </table>
    `),
  ].join(''),
};
