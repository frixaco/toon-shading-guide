import { sec, shot, box } from './kit';

const REF = { ref: 's7_toon', refPink: 's7_two' };

export const step7 = {
  title: 'The outline: a shell turned inside out',
  html: [
    sec({ mode: 'toon', lv: 61, pink: false, label: 'Step 6: no outline. The silhouette blends into the background' }, `
      <h2>7.1 What an outline is, geometrically</h2>
      <p>An ink outline sits where the surface <b>turns away from you</b>: the silhouette. At those points N·V (normal · direction to the camera) crosses 0.
      A shader runs one pixel at a time, and a pixel can't see its neighbours, so it can't tell \"I am next to an edge\" cheaply.
      The obvious per-pixel attempt, darkening wherever N·V is small, gives a line whose width depends on curvature: a broad smear where a gently curved surface turns away, almost nothing where an edge is sharp. The standard game trick avoids the question entirely by adding <b>geometry</b> instead of shading:</p>
      <ol>
        <li>Make a copy of the mesh and push every vertex outward along its normal by a small width <i>w</i>. That's a slightly fatter shell around the body.</li>
        <li>Paint the shell black, and draw only the faces of the shell that point <b>away</b> from the camera.</li>
      </ol>
      <p>Think about which shell faces survive. The shell's near side (the part between you and the body) faces you, so it's discarded, and you see the body through it.
      Its far side faces away, so it's drawn, but it's behind the body and hidden, except where it sticks out past the body's edge.
      What's left is a black band exactly <i>w</i> thick around every silhouette, including inner ones like an arm in front of the torso.
      This is called the <b>inverted hull</b>, and it's exactly what Unity's <code>ToonOutlinePass</code> does.</p>
    `),
    sec({ mode: 'toon', lv: 61, pink: false, label: 'Step 6 tree, now with Backface Culling on (no visible change)' }, `
      <h2>7.2 \"Draw only faces that point one way\": backface culling</h2>
      <p>Every triangle has a front and a back, decided by the order of its corners. <b>Backface culling</b> skips a triangle whenever its back is toward the camera.
      Unity's toon material has <code>Cull Back</code>, so it never draws the inside of open meshes such as the sweater. We match that on all three materials,
      and the outline material will need it to do its trick.</p>
      ${box('do', 'Do this (Skin, Sweater and Floor)', `<ol>
        <li>Properties → <b>Material</b> tab → <b>Settings</b> → <b>Backface Culling</b>: tick <b>Camera</b>. (Type \"Backface\" into the search box to find it.)</li>
      </ol>`)}
      ${shot('s7_cull', 'Material → Settings → Backface Culling: Camera.', 'narrow')}
      <h3>The outline material</h3>
      ${box('do', 'Do this', `<ol>
        <li>Make a new material called <code>Outline</code>. Delete the Principled BSDF and add an <b>Emission</b>, Color black. Wire it to Surface.</li>
        <li>Tick <b>Backface Culling → Camera</b> on it too.</li>
      </ol>`)}
      ${shot('s7_material', 'The Outline material: black Emission. Emission ignores all lights, so the line is black everywhere.')}
    `),
    sec({ mode: 'toon', lv: 70, knob: 'outline', pink: false, label: 'Step 7 result: the inverted-hull outline (body and sweater)', ...REF }, `
      <h2>7.3 Building the shell with Geometry Nodes</h2>
      <p>The shell must follow the body when it's posed or edited, so we generate it with a <b>Geometry Nodes</b> modifier on a new empty object.
      Geometry Nodes are node trees that compute <i>geometry</i> instead of colour: each node takes a mesh and returns a changed mesh.</p>
      ${box('do', 'Do this', `<ol>
        <li><kbd>Shift A</kbd> in the 3D viewport → <b>Mesh</b> → any mesh, rename it <code>Body_Outline</code>, then in Edit Mode delete all its vertices. It's just a container.</li>
        <li>Object properties → Visibility → Ray Visibility: untick <b>Shadow</b>. (The shell sits a millimetre outside the skin and would shadow it.)</li>
        <li>Modifier tab → <b>Add Modifier</b> → <b>Geometry Nodes</b> → <b>New</b>. Open the <b>Geometry Node Editor</b> and name the group <code>Outline Hull</code>.</li>
        <li>Build the tree below. In words:
          <ul>
            <li><b>Object Info</b> (Relative) reads the Body's mesh. Expose its Object input on the group as <b>Source</b>.</li>
            <li><b>Named Attribute</b> <code>uN</code> (Vector) → <b>Normalize</b>: the push direction.</li>
            <li><b>Named Attribute</b> <code>uUV</code> (Vector) → <b>Image Texture</b> (<code>out_line_mask.png</code>) → <b>Separate Color</b>, Red: the width mask.</li>
            <li>Width (a group input, 0.09) × 0.01 × mask → <b>Vector Math Scale</b> of the normal → <b>Set Position</b> Offset.</li>
            <li>→ <b>Flip Faces</b> → <b>Set Material</b> (Outline) → Group Output.</li>
          </ul></li>
      </ol>`)}
      ${shot('s7_hull', 'The Outline Hull geometry node group. Top row: copy the source mesh, push, flip, set material.')}
      ${box('why', 'Why Flip Faces, if we want the far side drawn?', `
        <p>Culling discards faces whose <i>back</i> is toward you, and we want to discard the near side, whose front is toward you. So we swap front and back on the shell.
        After the flip the near side shows its back (culled) and the far side shows its front (drawn). Two settings, one trick.</p>`)}
      ${box('why', 'Why the attribute uN and not the mesh\'s own normal?', `
        <p>Where the UV map has a seam, the mesh has two vertices at the same spot, one for each side. If each copy were pushed along a normal computed from only its own side's
        faces, the two copies would move apart and the outline would split open along every seam. <code>uN</code> is the normal Unity's mesh carries: the averaged normal,
        identical on both copies, so they move together. For the same reason the mask is read with <code>uUV</code>, a per-vertex copy of the UV:
        Geometry Nodes moves <i>vertices</i>, so it needs one value per vertex.</p>`)}
      ${box('num', 'What the numbers mean', `
        <p>Unity's outline width 0.09 is in centimetres: × 0.01 makes it 0.9 mm in metres. The red channel of <code>out_line_mask.png</code> scales it per vertex.
        White is full width, black is no outline, so the artist can thin the line wherever it would look too heavy by painting the mask darker there.</p>`)}
      ${box('do', 'Then the sweater', `<ol>
        <li>Make <code>Sweater_Outline</code> the same way, but reuse the <b>Outline Hull</b> group: in its modifier, pick the group from the dropdown and set <b>Source</b> to Sweater.</li>
      </ol>`)}
      ${shot('s7_sweater', 'Sweater_Outline\'s modifier: the same group, Source = Sweater. Groups are reusable functions.', 'narrow')}
      <p>In the 3D view, orbit around: the line follows every silhouette, including inner ones. Drag <b>Outline width</b> to see what the shell does when it's thick.</p>
      ${shot('s7_viewport', 'Blender\'s viewport at the end of step 7.')}
    `),
  ].join(''),
};
