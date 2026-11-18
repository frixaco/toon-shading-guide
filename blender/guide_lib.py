"""Shared scene + node-tree builders for the toon-shader guide.

A guide step is a list of sub-steps (Sub). Each one edits the scene, a material, the outline
geometry nodes or the compositor, and records the node names it touched, so shots.py can replay
a step one sub-step at a time and highlight what changed.
"""
import bpy, json, math, os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDE = os.path.dirname(HERE)
SR = os.path.dirname(GUIDE)
EXP = os.path.join(SR, "blender", "export")
TEX = os.path.join(SR, "blender", "textures")
WEB = os.path.join(GUIDE, "web")
PUB = os.path.join(WEB, "public")

RES = (960, 1080)
SHADOW_GREY = 0.3632074  # _OverallShadowColor
FLOOR_GREY = 0.358490556  # BG _BaseColor

# ------------------------------------------------------------------ SakuraRabbit's material values
SAT = {"Skin": 1.939, "Sweater": 1.46}  # _Saturation
THRESHOLD, HARDNESS = 0.95, 0.688  # _SelfShadowThreshold, _SelfShadowHardness
_t = -1.0 + 2.0 * THRESHOLD
NDL_SCALE = 7.0 + (_t - 7.0) * _t  # ToonCelShade: lerp(7, t, t) = 1.51
EDGE = 0.3 + 0.7 * HARDNESS  # lerp(0.3, 1, hardness) = 0.7816
CEL_LO, CEL_HI = EDGE / NDL_SCALE, 1.0 / NDL_SCALE  # the same smoothstep, on the 0..1 half-Lambert value
SELF_SHADOW = 0.942  # _SelfShadowIntensity
LIGHT_INTENSITY = 0.67  # _LightIntensity
COLOR_POWER = 0.15  # _ColorPower
LIT_CAP = 7.0  # ToonLitLightColor
MATCAP_INT = 0.598
OUTLINE_WIDTH = 0.09
RIM = dict(power=1.26, threshold=0.338, softness=0.421, intensity=0.692,
           color=(0.188088492, 0.164204225, 0.193396091))
SSAO_COLOR = (0.7764706, 0.427450985, 0.427450985)

# ------------------------------------------------------------------ lights + cameras (Blender coords)
SUN1 = dict(name="Sun", L=Vector((-0.55, -0.8, 0.75)).normalized(), color=(1.0, 1.0, 1.0), strength=math.pi)
SUN2 = dict(name="Pink Sun", L=Vector((0.9, 0.5, 0.35)).normalized(), color=(1.0, 0.35, 0.65), strength=math.pi)
CAM = dict(pos=Vector((1.25, -2.45, 0.95)), target=Vector((0.0, 0.0, 0.6)), fov_y=30.0)
RAMP_S2 = 0.15
RAMP_S3 = 0.575


def cv(v):
    """Unity world (left-handed, Y up) -> Blender world (right-handed, Z up)."""
    return Vector((-v[0], -v[2], v[1]))


def to_three(v):
    """Blender (Z up) -> three.js / glTF (Y up)."""
    return [v[0], v[2], -v[1]]


_LJ = json.load(open(os.path.join(EXP, "lights_final.json")))
_SJ = json.load(open(os.path.join(EXP, "scene.json")))
EXPOSURE = _LJ["exposureMultiplier"]
SPOTS = []
for _i, _l in enumerate(_LJ["lights"]):
    _k = next(x["intensity"] for x in _SJ["lights"] if x["name"] == _l["name"]) / _l["candela"]
    SPOTS.append(dict(name=_l["name"], pos=cv(_l["posU"]), fwd=cv(_l["fwdU"]).normalized(),
                      hd=tuple(c * _k * EXPOSURE for c in _l["finalColor"]), outer=_l["outer"], range=_l["range"],
                      angle_scale=_l["angleScale"], angle_offset=_l["angleOffset"], range_scale=_l["rangeScale"],
                      channel=tuple(1.0 if j == _i else 0.0 for j in range(3))))
SHOT = dict(pos=cv(_LJ["camera"]["posU"]), fwd=cv(_LJ["camera"]["fwdU"]).normalized(),
            up=cv(_LJ["camera"]["upU"]).normalized(), fov_y=_LJ["camera"]["fovV"],
            res=(_SJ["camera"]["pixelW"], _SJ["camera"]["pixelH"]), near=_SJ["camera"]["near"])
FLOOR_EMIT = tuple(c * EXPOSURE for c in (561.35, 766.6813, 937.056641))  # BG _EmissiveColor, pre-exposed
FOG = dict(mfp=80.0, base=0.0, maxh=50.0, maxd=70.0)
DOF = dict(near=1.68, far=2.0, radius_1080=13.0)
GRADE = dict(post_exposure=0.3, contrast=0.9, saturation=1.03)
AO_DIST, AO_POWER = 0.25, 2.0


# ------------------------------------------------------------------ scene
def reset():
    for coll in (bpy.data.objects, bpy.data.collections, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.node_groups, bpy.data.meshes):
        for x in list(coll):
            coll.remove(x)
    for im in list(bpy.data.images):
        if im.type == "IMAGE":
            bpy.data.images.remove(im)
    _IMG.clear()


def build_mesh(fname, objname):
    d = json.load(open(os.path.join(EXP, fname)))
    pos, tris = d["pos"], d["tris"]
    n = len(pos) // 3
    verts = [cv(pos[3 * i:3 * i + 3]) for i in range(n)]
    faces = [(tris[i], tris[i + 2], tris[i + 1]) for i in range(0, len(tris), 3)]
    me = bpy.data.meshes.new(objname)
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new(objname, me)
    bpy.context.scene.collection.objects.link(ob)
    uv = d["uv"]
    if uv:
        lay = me.uv_layers.new(name="UVMap")
        lv = [0] * len(me.loops)
        me.loops.foreach_get("vertex_index", lv)
        flat = []
        for vi in lv:
            flat += (uv[2 * vi], uv[2 * vi + 1])
        lay.data.foreach_set("uv", flat)
        a = me.attributes.new("uUV", "FLOAT2", "POINT")  # per-vertex UV (Unity splits vertices at seams)
        a.data.foreach_set("vector", uv)
    nrm = [cv(d["nrm"][3 * i:3 * i + 3]) for i in range(n)]
    me.shade_smooth()
    me.normals_split_custom_set_from_vertices(nrm)
    a = me.attributes.new("uN", "FLOAT_VECTOR", "POINT")  # Unity's smooth normal, same on both sides of a seam
    a.data.foreach_set("vector", [c for v in nrm for c in v])
    if "tan" in d:  # Unity's tangent frame, which the sweater's normal map was made against
        tan, T, Bt = d["tan"], [], []
        for i in range(n):
            nu, tu, w = Vector(d["nrm"][3 * i:3 * i + 3]), Vector(tan[4 * i:4 * i + 3]), tan[4 * i + 3]
            T.append(cv(tu))
            Bt.append(cv(nu.cross(tu) * w))  # Unity: bitangent = cross(N, T) * w
        for name, data in (("uT", T), ("uB", Bt)):
            a = me.attributes.new(name, "FLOAT_VECTOR", "POINT")
            a.data.foreach_set("vector", [c for v in data for c in v])
    return ob


_IMG = {}


def image(name, colorspace="sRGB"):
    if name not in _IMG:
        im = bpy.data.images.load(os.path.join(TEX, name), check_existing=True)
        im.colorspace_settings.name = colorspace
        _IMG[name] = im
    return _IMG[name]


def textures():
    return {"Skin": image("body_Color.png"), "Sweater": image("Sweater_Color.jpg")}


def add_sun(cfg, hidden=False):
    ld = bpy.data.lights.new(cfg["name"], "SUN")
    ld.energy = cfg["strength"]
    ld.color = cfg["color"]
    ld.angle = math.radians(0.5)
    ob = bpy.data.objects.new(cfg["name"], ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = cfg["L"].to_track_quat("Z", "Y").to_euler()
    ob.location = cfg["L"] * 2.5 + Vector((0, 0, 0.6))  # suns ignore position; this keeps the icon visible
    ob.hide_render = ob.hide_viewport = hidden
    return ob


def base_scene():
    """Step 0: just the meshes, a camera and a floor. No light."""
    reset()
    sc = bpy.context.scene
    sc.name = "Guide"
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.eevee.taa_render_samples = 16
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "None"
    sc.render.use_compositing = False
    sc.compositing_node_group = None
    if not sc.world:
        sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.05, 0.05, 0.05, 1)
    bg.inputs["Strength"].default_value = 1.0
    vl = sc.view_layers[0]
    vl.name = "ViewLayer"
    while len(vl.aovs):
        vl.aovs.remove(vl.aovs[0])
    for p in ("diffuse_direct", "glossy_direct", "z", "position", "ambient_occlusion"):
        setattr(vl, "use_pass_" + p, False)
    for scr in bpy.data.screens:
        for area in scr.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.shading.use_compositor = "DISABLED"
    body = build_mesh("mesh_Body.json", "Body")
    sweater = build_mesh("mesh_Sweater.json", "Sweater")
    floor = build_mesh("mesh_bg_cyclo.json", "Floor")
    floor.visible_shadow = False  # the backdrop must not block lights that come from behind it
    for ob, nm in ((body, "Skin"), (sweater, "Sweater"), (floor, "Floor")):
        m = bpy.data.materials.new(nm)
        m.use_nodes = True
        ob.data.materials.append(m)
    t = floor.data.materials[0].node_tree
    t.nodes.remove(t.nodes["Principled BSDF"])
    d = t.nodes.new("ShaderNodeBsdfDiffuse")
    d.inputs["Color"].default_value = (FLOOR_GREY, FLOOR_GREY, FLOOR_GREY, 1)
    t.links.new(d.outputs[0], t.nodes["Material Output"].inputs["Surface"])
    cd = bpy.data.cameras.new("Camera")
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(CAM["fov_y"])
    cd.clip_start, cd.clip_end = 0.05, 200
    cam = bpy.data.objects.new("Camera", cd)
    sc.collection.objects.link(cam)
    cam.location = CAM["pos"]
    cam.rotation_euler = (CAM["target"] - CAM["pos"]).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    return body, sweater, floor


# ------------------------------------------------------------------ node building
# Final positions of the toon tree (Skin and Sweater) from step 4 on. Steps 1-3 lay out their own.
LAYOUT = {
    "Normal Texture": (-2750, 150), "Normal Map": (-2500, 150),
    "Geometry": (-2250, 150), "Light Evaluation": (-2250, -200),
    "Dot Product": (-2000, 0), "Remap": (-1800, 0), "Cel Edge": (-1600, 0),
    "Facing x Seeing": (-1380, 0), "Shadow Strength": (-1180, 0), "Shadow Tone": (-980, 0),
    "Mix": (-760, 0), "Light Weight": (-760, 0), "x Falloff": (-560, 0), "x Channel": (-360, 0),
    "Light Accumulation": (-100, 0), "Material Output": (200, 0),
    "Shadow Raycast": (-1800, -330), "Shadow Soften": (-1600, -330),
    "Light Info": (-980, -330), "Spot Falloff": (-760, -330), "Channel": (-560, -330),
    "Light Color": (-2000, -620), "lc": (-1800, -620), "lc RGB": (-1600, -620),
    "Peak": (-1420, -620), "Peak 2": (-1250, -620), "7 / Peak": (-1080, -620), "Cap": (-910, -620),
    "Matcap Normal": (-1800, -950), "Matcap UV": (-1600, -950), "Matcap": (-1400, -950),
    "Matcap Strength": (-1100, -950), "Image Texture": (-1400, -1250), "Albedo": (-850, -1050),
    "Color Power": (-640, -1050),
    "AOV albedo": (-380, -1050), "AOV mask": (-380, -1250), "AOV sat": (-380, -1400),
    "AOV rimA": (-150, -1250), "AOV rimB": (-150, -1400),
    "N.V": (-2000, 450), "1 - N.V": (-1800, 450), "Rim Power": (-1600, 450), "Rim Edge": (-1380, 450),
    "Rim x Shade": (-980, 450), "Rim x Falloff": (-560, 450), "Rim x Channel": (-360, 450),
}


class Kit:
    """Adds named, positioned nodes to one node tree and records what changed."""

    def __init__(self, tree, name=""):
        self.t = tree.node_tree if hasattr(tree, "node_tree") else tree
        self.name = name or getattr(tree, "name", "")
        self.touched = set()

    def clear(self, keep_output=True):
        for nd in list(self.t.nodes):
            if keep_output and nd.bl_idname == "ShaderNodeOutputMaterial":
                continue
            self.t.nodes.remove(nd)
        out = self.out()
        out.location = (400, 0)
        out.target = "ALL"

    def out(self):
        return next(nd for nd in self.t.nodes if nd.bl_idname == "ShaderNodeOutputMaterial")

    def get(self, name):
        return self.t.nodes[name]

    def has(self, name):
        return name in self.t.nodes

    def rm(self, name):
        if name in self.t.nodes:
            self.t.nodes.remove(self.t.nodes[name])

    def node(self, typ, name, loc=None, label=None, **props):
        self.rm(name)
        nd = self.t.nodes.new(typ)
        nd.name = name
        if label:
            nd.label = label
        nd.location = loc if loc is not None else LAYOUT.get(name, (0, 0))
        for k, v in props.items():
            setattr(nd, k, v)
        self.touched.add(nd.name)
        return nd

    def link(self, a, b):
        self.t.links.new(a, b)
        self.touched.add(a.node.name)
        self.touched.add(b.node.name)

    def place(self):
        for nd in self.t.nodes:
            if nd.name in LAYOUT:
                nd.location = LAYOUT[nd.name]

    def take(self):
        t, self.touched = self.touched, set()
        return t


def ramp_setup(ramp, pos, dark=SHADOW_GREY):
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].position = 0.0
    cr.elements[0].color = (dark, dark, dark, 1)
    cr.elements[1].position = pos
    cr.elements[1].color = (1, 1, 1, 1)


def mix(k, name, blend, data="RGBA", fac=1.0, **kw):
    m = k.node("ShaderNodeMix", name, data_type=data, blend_type=blend, **kw)
    m.inputs[0].default_value = fac
    return m


A, B = 6, 7  # colour A/B sockets of a Mix node
FA, FB = 2, 3  # float A/B


def normal_socket(k):
    """The shading normal: the normal map's output once it exists (Sweater, step 10), else Geometry Normal."""
    return k.get("Normal Map").outputs["Normal"] if k.has("Normal Map") else k.get("Geometry").outputs["Normal"]


class Sub:
    """One sub-step. on: 'mats' (Skin then Sweater), 'sweater', 'floor', or 'scene'.
    shot: None, ('nodes', material), ('group', group name, material), ('comp',), ('geo', object),
    ('props', context, object, search, click_y) or 'auto' (= nodes of the first material it ran on)."""

    def __init__(self, key, fn, on="mats", shot="auto"):
        self.key, self.fn, self.on, self.shot = key, fn, on, shot


# ================================================================== step 1
def s1_world():
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)


def s1_view():
    bpy.context.scene.view_settings.view_transform = "Standard"


def s1_sun():
    add_sun(SUN1)


def s1_diffuse(k, tex):
    k.clear()
    d = k.node("ShaderNodeBsdfDiffuse", "Diffuse BSDF", (100, 0))
    k.link(d.outputs["BSDF"], k.out().inputs["Surface"])


def s1_texture(k, tex):
    it = k.node("ShaderNodeTexImage", "Image Texture", (-250, 0), image=tex)
    k.link(it.outputs["Color"], k.get("Diffuse BSDF").inputs["Color"])


# ================================================================== step 2
def s2_measure(k, tex):
    k.clear()
    d = k.node("ShaderNodeBsdfDiffuse", "Diffuse BSDF", (-900, 0))
    d.inputs["Color"].default_value = (1, 1, 1, 1)
    s = k.node("ShaderNodeShaderToRGB", "Shader to RGB", (-680, 0))
    k.link(d.outputs["BSDF"], s.inputs["Shader"])


def s2_ramp(k, tex):
    r = k.node("ShaderNodeValToRGB", "Color Ramp", (-480, 0))
    ramp_setup(r, RAMP_S2)
    k.link(k.get("Shader to RGB").outputs["Color"], r.inputs["Fac"])


def s2_texture(k, tex):
    it = k.node("ShaderNodeTexImage", "Image Texture", (-480, -300), image=tex)
    m = k.node("ShaderNodeMix", "Mix", (-160, 0), data_type="RGBA", blend_type="MULTIPLY")
    m.inputs[0].default_value = 1.0
    k.link(k.get("Color Ramp").outputs["Color"], m.inputs[A])
    k.link(it.outputs["Color"], m.inputs[B])


def s2_emission(k, tex):
    e = k.node("ShaderNodeEmission", "Emission", (100, 0))
    e.inputs["Strength"].default_value = 1.0
    k.link(k.get("Mix").outputs["Result"], e.inputs["Color"])
    k.link(e.outputs["Emission"], k.out().inputs["Surface"])


def s2_pink():
    if "Pink Sun" not in bpy.data.objects:
        add_sun(SUN2, hidden=True)


# ================================================================== step 3
def s3_dot(k, tex):
    k.clear()
    g = k.node("ShaderNodeNewGeometry", "Geometry", (-1250, 80))
    le = k.node("ShaderNodeLightEvaluation", "Light Evaluation", (-1250, -260))
    d = k.node("ShaderNodeVectorMath", "Dot Product", (-1000, 0), operation="DOT_PRODUCT")
    k.link(g.outputs["Normal"], d.inputs[0])
    k.link(le.outputs["Direction"], d.inputs[1])


def s3_remap(k, tex):
    m = k.node("ShaderNodeMath", "Remap", (-800, 0), label="x 0.5 + 0.5", operation="MULTIPLY_ADD")
    m.inputs[1].default_value = 0.5
    m.inputs[2].default_value = 0.5
    k.link(k.get("Dot Product").outputs["Value"], m.inputs[0])


def s3_ramp(k, tex):
    r = k.node("ShaderNodeValToRGB", "Color Ramp", (-610, 0))
    ramp_setup(r, RAMP_S3)
    k.link(k.get("Remap").outputs["Value"], r.inputs["Fac"])


def s3_lightcolor(k, tex):
    li = k.node("ShaderNodeLightInfo", "Light Info", (-610, -280))
    m = k.node("ShaderNodeMix", "Mix", (-300, 0), data_type="RGBA", blend_type="MULTIPLY")
    m.inputs[0].default_value = 1.0
    k.link(k.get("Color Ramp").outputs["Color"], m.inputs[A])
    k.link(li.outputs["Color"], m.inputs[B])


def s3_accumulate(k, tex):
    it = k.node("ShaderNodeTexImage", "Image Texture", (-300, -300), image=tex)
    a = k.node("ShaderNodeLightAccumulation", "Light Accumulation", (100, 0))
    a.inputs["Glossy Color"].default_value = (0, 0, 0, 1)
    a.inputs["Transmission Color"].default_value = (0, 0, 0, 1)
    k.link(k.get("Mix").outputs["Result"], a.inputs["Diffuse Light"])
    k.link(it.outputs["Color"], a.inputs["Diffuse Color"])
    k.link(a.outputs["Shader"], k.out().inputs["Surface"])


# ================================================================== step 4: soft edge
def s4_edge(k, tex):
    k.rm("Color Ramp")
    k.place()
    k.get("Mix").label = "x light colour"
    ce = k.node("ShaderNodeMapRange", "Cel Edge", label="soft edge (smoothstep)", interpolation_type="SMOOTHSTEP", clamp=True)
    ce.inputs["From Min"].default_value = CEL_LO
    ce.inputs["From Max"].default_value = CEL_HI
    k.link(k.get("Remap").outputs["Value"], ce.inputs["Value"])


def s4_strength(k, tex):
    ss = k.node("ShaderNodeMath", "Shadow Strength", label="x 0.942 + 0.058", operation="MULTIPLY_ADD")
    ss.inputs[1].default_value = SELF_SHADOW
    ss.inputs[2].default_value = 1.0 - SELF_SHADOW
    k.link(k.get("Cel Edge").outputs["Result"], ss.inputs[0])


def s4_tone(k, tex):
    st = mix(k, "Shadow Tone", "MIX", data="FLOAT", label="shadow tone → lit")
    st.inputs[FA].default_value = SHADOW_GREY
    st.inputs[FB].default_value = 1.0
    k.link(k.get("Shadow Strength").outputs["Value"], st.inputs[0])
    k.link(st.outputs["Result"], k.get("Mix").inputs[A])


# ================================================================== step 5: cast shadows
def s5_raycast(k, tex):
    sr = k.node("ShaderNodeShadowRaycast", "Shadow Raycast")
    sr.inputs["Softness"].default_value = 0.0
    so = k.node("ShaderNodeMapRange", "Shadow Soften", label="smoothstep(0, 1, shadow)", interpolation_type="SMOOTHSTEP", clamp=True)
    k.link(sr.outputs["Color"], so.inputs["Value"])


def s5_combine(k, tex):
    fs = k.node("ShaderNodeMath", "Facing x Seeing", label="facing x seeing", operation="MULTIPLY")
    k.link(k.get("Cel Edge").outputs["Result"], fs.inputs[0])
    k.link(k.get("Shadow Soften").outputs["Result"], fs.inputs[1])
    k.link(fs.outputs["Value"], k.get("Shadow Strength").inputs[0])


# ================================================================== step 6: matcap
def s6_uv(k, tex):
    vt = k.node("ShaderNodeVectorTransform", "Matcap Normal", label="normal: world → camera",
                vector_type="VECTOR", convert_from="WORLD", convert_to="CAMERA")
    k.link(normal_socket(k), vt.inputs["Vector"])
    uv = k.node("ShaderNodeVectorMath", "Matcap UV", label="xy x 0.5 + 0.5", operation="MULTIPLY_ADD")
    uv.inputs[1].default_value = (0.5, 0.5, 0.0)
    uv.inputs[2].default_value = (0.5, 0.5, 0.0)
    k.link(vt.outputs["Vector"], uv.inputs[0])


def s6_lookup(k, tex):
    mc = k.node("ShaderNodeTexImage", "Matcap", image=image("spheremapSkin.psd"))
    k.link(k.get("Matcap UV").outputs["Vector"], mc.inputs["Vector"])
    ms = mix(k, "Matcap Strength", "MIX", fac=MATCAP_INT, label="white → matcap, 0.598")
    ms.inputs[A].default_value = (1, 1, 1, 1)
    k.link(mc.outputs["Color"], ms.inputs[B])


def s6_albedo(k, tex):
    al = mix(k, "Albedo", "MULTIPLY", label="albedo = texture x matcap")
    k.link(k.get("Image Texture").outputs["Color"], al.inputs[A])
    k.link(k.get("Matcap Strength").outputs["Result"], al.inputs[B])
    k.link(al.outputs["Result"], k.get("Light Accumulation").inputs["Diffuse Color"])


# ================================================================== step 7: outline
def outline_material():
    m = bpy.data.materials.get("Outline") or bpy.data.materials.new("Outline")
    m.use_nodes = True
    m.use_backface_culling = True
    k = Kit(m)
    k.clear()
    e = k.node("ShaderNodeEmission", "Emission", (100, 0))
    e.inputs["Color"].default_value = (0, 0, 0, 1)
    k.link(e.outputs["Emission"], k.out().inputs["Surface"])
    return m


def outline_group():
    g = bpy.data.node_groups.get("Outline Hull")
    if g:
        return g
    g = bpy.data.node_groups.new("Outline Hull", "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    s = g.interface.new_socket("Source", in_out="INPUT", socket_type="NodeSocketObject")
    w = g.interface.new_socket("Width", in_out="INPUT", socket_type="NodeSocketFloat")
    w.default_value = OUTLINE_WIDTH
    k = Kit(g, "Outline Hull")
    gi = k.node("NodeGroupInput", "Group Input", (-1200, 0))
    oi = k.node("GeometryNodeObjectInfo", "Object Info", (-900, 150), transform_space="RELATIVE")
    k.link(gi.outputs["Source"], oi.inputs["Object"])
    na = k.node("GeometryNodeInputNamedAttribute", "Unity Normal", (-1200, -250), label="Named Attribute: uN", data_type="FLOAT_VECTOR")
    na.inputs["Name"].default_value = "uN"
    nn = k.node("ShaderNodeVectorMath", "Normalize", (-950, -250), operation="NORMALIZE")
    k.link(na.outputs["Attribute"], nn.inputs[0])
    ua = k.node("GeometryNodeInputNamedAttribute", "Unity UV", (-1200, -450), label="Named Attribute: uUV", data_type="FLOAT_VECTOR")
    ua.inputs["Name"].default_value = "uUV"
    it = k.node("GeometryNodeImageTexture", "Width Mask", (-950, -450), label="Image Texture: out_line_mask")
    it.inputs["Image"].default_value = image("out_line_mask.png")
    k.link(ua.outputs["Attribute"], it.inputs["Vector"])
    sp = k.node("FunctionNodeSeparateColor", "Mask Red", (-720, -450))
    k.link(it.outputs["Color"], sp.inputs[0])
    cm = k.node("ShaderNodeMath", "cm", (-950, -100), label="x 0.01 (cm → m)", operation="MULTIPLY")
    cm.inputs[1].default_value = 0.01
    k.link(gi.outputs["Width"], cm.inputs[0])
    mm = k.node("ShaderNodeMath", "x Mask", (-520, -200), label="x mask", operation="MULTIPLY")
    k.link(cm.outputs[0], mm.inputs[0])
    k.link(sp.outputs[0], mm.inputs[1])
    off = k.node("ShaderNodeVectorMath", "Offset", (-330, -200), label="normal x width", operation="SCALE")
    k.link(nn.outputs[0], off.inputs[0])
    k.link(mm.outputs[0], off.inputs["Scale"])
    setp = k.node("GeometryNodeSetPosition", "Set Position", (-130, 100))
    k.link(oi.outputs["Geometry"], setp.inputs["Geometry"])
    k.link(off.outputs[0], setp.inputs["Offset"])
    ff = k.node("GeometryNodeFlipFaces", "Flip Faces", (80, 100))
    k.link(setp.outputs[0], ff.inputs[0])
    sm = k.node("GeometryNodeSetMaterial", "Set Material", (280, 100))
    sm.inputs["Material"].default_value = outline_material()
    k.link(ff.outputs[0], sm.inputs["Geometry"])
    go = k.node("NodeGroupOutput", "Group Output", (480, 100))
    k.link(sm.outputs[0], go.inputs[0])
    return g


def add_outline(src_name):
    nm = src_name + "_Outline"
    if nm in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[nm])
    ob = bpy.data.objects.new(nm, bpy.data.meshes.new(nm))
    bpy.context.scene.collection.objects.link(ob)
    ob.visible_shadow = False  # the hull sits just outside the skin and would shadow it
    mod = ob.modifiers.new("Outline", "NODES")
    mod.node_group = outline_group()
    ident = next(s.identifier for s in mod.node_group.interface.items_tree if s.name == "Source")
    getattr(mod.properties.inputs, ident).value = bpy.data.objects[src_name]  # Blender 5.3 modifier input API
    return ob


def s7_material():
    outline_material()


def s7_cull():
    for nm in ("Skin", "Sweater", "Floor"):
        bpy.data.materials[nm].use_backface_culling = True  # Unity: Cull Back
    bpy.context.view_layer.objects.active = bpy.data.objects["Body"]


def s7_hull():
    add_outline("Body")


def s7_sweater():
    add_outline("Sweater")


# ================================================================== step 8: spotlights
def fwd_drivers(ob, prop="fwd"):
    """fwd = the light's -Z axis in world space, kept in sync with its rotation by drivers."""
    exprs = ("-(cos(rx)*sin(ry)*cos(rz) + sin(rx)*sin(rz))",
             "-(cos(rx)*sin(ry)*sin(rz) - sin(rx)*cos(rz))",
             "-(cos(rx)*cos(ry))")
    for i, ex in enumerate(exprs):
        fc = ob.driver_add(f'["{prop}"]', i)
        d = fc.driver
        d.type = "SCRIPTED"
        for v in list(d.variables):
            d.variables.remove(v)
        for nm, ch in (("rx", "ROT_X"), ("ry", "ROT_Y"), ("rz", "ROT_Z")):
            v = d.variables.new()
            v.name = nm
            v.type = "TRANSFORMS"
            v.targets[0].id = ob
            v.targets[0].transform_type = ch
            v.targets[0].transform_space = "WORLD_SPACE"
        d.expression = ex


def s8_lights():
    for nm in ("Sun", "Pink Sun"):
        if nm in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[nm])
    for s in SPOTS:
        ld = bpy.data.lights.new(s["name"], "SPOT")
        ld.spot_size = math.radians(s["outer"])
        ld.spot_blend = 0.0
        ld.energy = 1000.0  # only needs to be > 0: our nodes compute the brightness themselves
        ld.shadow_soft_size = 0.025
        ld.use_custom_distance = True
        ld.cutoff_distance = s["range"]
        ob = bpy.data.objects.new(s["name"], ld)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = s["pos"]
        ob.rotation_euler = s["fwd"].to_track_quat("-Z", "Y").to_euler()
        ob["hd_color"] = list(s["hd"])
        ob["fwd"] = list(s["fwd"])
        ob["angle_scale"] = s["angle_scale"]
        ob["angle_offset"] = s["angle_offset"]
        ob["range_scale"] = s["range_scale"]
        ob["channel"] = list(s["channel"])
        fwd_drivers(ob)


def falloff_group():
    g = bpy.data.node_groups.get("HDRP Spot Falloff")
    if g:
        return g
    g = bpy.data.node_groups.new("HDRP Spot Falloff", "ShaderNodeTree")
    g.interface.new_socket("Attenuation", in_out="OUTPUT", socket_type="NodeSocketFloat")
    g.interface.new_socket("Toon Falloff", in_out="OUTPUT", socket_type="NodeSocketFloat")
    k = Kit(g, "HDRP Spot Falloff")
    le = k.node("ShaderNodeLightEvaluation", "Light Evaluation", (-1100, 0))

    def attr(name, nm, loc):
        a = k.node("ShaderNodeAttribute", nm, loc, label=f"Light attribute: {name}", attribute_type="LIGHT", attribute_name=name)
        return a

    def m(name, op, loc, a=None, b=None, label=None, clamp=False):
        nd = k.node("ShaderNodeMath", name, loc, label=label, operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                k.link(v, nd.inputs[i])
            else:
                nd.inputs[i].default_value = v
        return nd.outputs[0]

    dist = le.outputs["Distance"]
    # distance: 1/d (capped at 100), and HDRP's range window (1 - (d^2 * rangeScale)^2), clamped to 0..1
    inv = m("1/d", "DIVIDE", (-850, 250), 1.0, dist, label="1 / d")
    inv = m("cap 100", "MINIMUM", (-650, 250), inv, 100.0, label="min(·, 100)")
    rs = attr("range_scale", "range_scale", (-1100, -250))
    d2 = m("d^2", "MULTIPLY", (-850, 50), dist, dist, label="d²")
    d2s = m("d^2 x rs", "MULTIPLY", (-650, 50), d2, rs.outputs["Factor"], label="d² x range_scale")
    win = m("win sq", "POWER", (-450, 50), d2s, 2.0, label="(·)²")
    win = m("window", "SUBTRACT", (-250, 50), 1.0, win, label="1 − (·) (clamp)", clamp=True)
    # angle: cos between the light's forward axis and the ray light → point, mapped by angleScale/Offset
    fw = attr("fwd", "fwd", (-1100, -450))
    cosv = k.node("ShaderNodeVectorMath", "cos", (-850, -350), label="L · fwd", operation="DOT_PRODUCT")
    k.link(le.outputs["Direction"], cosv.inputs[0])
    k.link(fw.outputs["Vector"], cosv.inputs[1])
    asc = attr("angle_scale", "angle_scale", (-1100, -650))
    aof = attr("angle_offset", "angle_offset", (-1100, -850))
    neg = m("-cos", "MULTIPLY", (-650, -350), cosv.outputs["Value"], -1.0, label="x −1")
    ang = k.node("ShaderNodeMath", "angle", (-450, -350), label="x scale + offset (clamp)", operation="MULTIPLY_ADD", use_clamp=True)
    k.link(neg, ang.inputs[0])
    k.link(asc.outputs["Factor"], ang.inputs[1])
    k.link(aof.outputs["Factor"], ang.inputs[2])
    a1 = m("inv x win", "MULTIPLY", (-50, 150), inv, win, label="x")
    a2 = m("x angle", "MULTIPLY", (130, 0), a1, ang.outputs[0], label="x")
    att = m("squared", "POWER", (310, 0), a2, 2.0, label="(·)² = attenuation")
    sat_ = m("clamp", "MINIMUM", (490, -150), att, 1.0, label="min(·, 1)")
    tf = k.node("ShaderNodeMapRange", "toon", (670, -150), label="smoothstep(0, 1, ·)", interpolation_type="SMOOTHSTEP", clamp=True)
    k.link(sat_, tf.inputs["Value"])
    go = k.node("NodeGroupOutput", "Group Output", (900, 0))
    k.link(att, go.inputs["Attenuation"])
    k.link(tf.outputs["Result"], go.inputs["Toon Falloff"])
    return g


def s8_group():
    falloff_group()


def s8_lightcolor(k, tex):
    k.rm("Light Info")
    la = k.node("ShaderNodeAttribute", "Light Color", label="Light attribute: hd_color", attribute_type="LIGHT", attribute_name="hd_color")
    lc = k.node("ShaderNodeVectorMath", "lc", label="x Light Intensity 0.67", operation="SCALE")
    lc.inputs["Scale"].default_value = LIGHT_INTENSITY
    k.link(la.outputs["Vector"], lc.inputs[0])
    k.link(lc.outputs["Vector"], k.get("Mix").inputs[B])


def s8_falloff(k, tex):
    gn = k.node("ShaderNodeGroup", "Spot Falloff", label="HDRP Spot Falloff")
    gn.node_tree = falloff_group()
    xf = k.node("ShaderNodeVectorMath", "x Falloff", label="x falloff", operation="SCALE")
    k.link(k.get("Mix").outputs["Result"], xf.inputs[0])
    k.link(gn.outputs["Toon Falloff"], xf.inputs["Scale"])
    k.link(xf.outputs["Vector"], k.get("Light Accumulation").inputs["Diffuse Light"])


def s8_colorpower(k, tex):
    cp = k.node("ShaderNodeVectorMath", "Color Power", label="x Color Power 0.15", operation="SCALE")
    cp.inputs["Scale"].default_value = COLOR_POWER
    k.link(k.get("Albedo").outputs["Result"], cp.inputs[0])
    k.link(cp.outputs["Vector"], k.get("Light Accumulation").inputs["Diffuse Color"])


def s8_floor(k):
    """HDRP/Lit backdrop: Disney diffuse x spot attenuation x shadow, plus a faint emissive glow."""
    k.clear()
    k.out().location = (900, 0)
    geo = k.node("ShaderNodeNewGeometry", "Geometry", (-1500, 200))
    le = k.node("ShaderNodeLightEvaluation", "Light Evaluation", (-1500, -150))

    def m(name, op, loc, a=None, b=None, c=None, label=None, clamp=False):
        nd = k.node("ShaderNodeMath", name, loc, label=label, operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                k.link(v, nd.inputs[i])
            else:
                nd.inputs[i].default_value = v
        return nd.outputs[0]

    def dot(name, a, b, loc, label):
        nd = k.node("ShaderNodeVectorMath", name, loc, label=label, operation="DOT_PRODUCT")
        k.link(a, nd.inputs[0])
        k.link(b, nd.inputs[1])
        return nd.outputs["Value"]

    N, V, L = geo.outputs["Normal"], geo.outputs["Incoming"], le.outputs["Direction"]
    ndl = m("N.L", "MAXIMUM", (-1050, 300), dot("dNL", N, L, (-1250, 300), "N · L"), 0.0, label="max(·, 0)")
    ndv = m("N.V", "MAXIMUM", (-1050, 100), dot("dNV", N, V, (-1250, 100), "N · V"), 0.0, label="max(·, 0)")
    fd90 = m("fd90", "ADD", (-1050, -100), dot("dLV", L, V, (-1250, -100), "L · V"), 1.5, label="fd90 = L·V + 1.5")

    def schlick(u, name, y):
        p = m(name + " 1-u", "SUBTRACT", (-850, y), 1.0, u, label="1 − u")
        p = m(name + " ^5", "POWER", (-670, y), p, 5.0, label="(·)⁵")
        f = m(name + " f-1", "SUBTRACT", (-850, y - 120), fd90, 1.0, label="fd90 − 1")
        return m(name, "MULTIPLY_ADD", (-490, y), p, f, 1.0, label="1 + (fd90−1)(1−u)⁵")

    s1 = schlick(ndl, "F(N·L)", 400)
    s2 = schlick(ndv, "F(N·V)", 120)
    dis = m("disney", "MULTIPLY", (-300, 300), s1, s2, label="x")
    dis = m("disney/pi", "DIVIDE", (-120, 300), dis, 1.03571 * math.pi, label="/ (1.03571 π)")
    dl = m("x N.L", "MULTIPLY", (60, 300), dis, ndl, label="x N·L")
    gn = k.node("ShaderNodeGroup", "Spot Falloff", (-300, -250), label="HDRP Spot Falloff")
    gn.node_tree = falloff_group()
    sr = k.node("ShaderNodeShadowRaycast", "Shadow Raycast", (-300, -480))
    sr.inputs["Softness"].default_value = 0.0
    a1 = m("x att", "MULTIPLY", (240, 200), dl, gn.outputs["Attenuation"], label="x attenuation")
    a2 = m("x shadow", "MULTIPLY", (420, 100), a1, sr.outputs["Color"], label="x shadow")
    la = k.node("ShaderNodeAttribute", "Light Color", (240, -150), label="Light attribute: hd_color", attribute_type="LIGHT", attribute_name="hd_color")
    hl = k.node("ShaderNodeVectorMath", "light", (600, 50), label="hd_color x ·", operation="SCALE")
    k.link(la.outputs["Vector"], hl.inputs[0])
    k.link(a2, hl.inputs["Scale"])
    acc = k.node("ShaderNodeLightAccumulation", "Light Accumulation", (780, 50))
    acc.inputs["Diffuse Color"].default_value = (FLOOR_GREY, FLOOR_GREY, FLOOR_GREY, 1)
    acc.inputs["Glossy Color"].default_value = (0, 0, 0, 1)
    acc.inputs["Transmission Color"].default_value = (0, 0, 0, 1)
    k.link(hl.outputs["Vector"], acc.inputs["Diffuse Light"])
    em = k.node("ShaderNodeEmission", "Emission", (780, -250))
    em.inputs["Color"].default_value = FLOOR_EMIT + (1,)
    add = k.node("ShaderNodeAddShader", "Add Shader", (980, -50))
    k.link(acc.outputs["Shader"], add.inputs[0])
    k.link(em.outputs["Emission"], add.inputs[1])
    k.out().location = (1160, -50)
    k.link(add.outputs[0], k.out().inputs["Surface"])


# ================================================================== step 9: cap, brightest wins, saturation
def s9_cap(k, tex):
    sp = k.node("ShaderNodeSeparateColor", "lc RGB", label="Separate Color")
    k.link(k.get("lc").outputs["Vector"], sp.inputs[0])
    p1 = k.node("ShaderNodeMath", "Peak", label="max(R, G)", operation="MAXIMUM")
    k.link(sp.outputs[0], p1.inputs[0])
    k.link(sp.outputs[1], p1.inputs[1])
    p2 = k.node("ShaderNodeMath", "Peak 2", label="max(·, B) = peak", operation="MAXIMUM")
    k.link(p1.outputs[0], p2.inputs[0])
    k.link(sp.outputs[2], p2.inputs[1])
    dv = k.node("ShaderNodeMath", "7 / Peak", label="7 / peak", operation="DIVIDE")
    dv.inputs[0].default_value = LIT_CAP
    k.link(p2.outputs[0], dv.inputs[1])
    cp = k.node("ShaderNodeMath", "Cap", label="min(·, 1) = cap", operation="MINIMUM")
    cp.inputs[1].default_value = 1.0
    k.link(dv.outputs[0], cp.inputs[0])
    k.link(cp.outputs[0], k.get("Shadow Tone").inputs[FB])


def s9_pack(k, tex):
    k.rm("Mix")
    k.rm("x Falloff")
    lw = k.node("ShaderNodeMath", "Light Weight", label="x Light Intensity 0.67", operation="MULTIPLY")
    lw.inputs[1].default_value = LIGHT_INTENSITY
    k.link(k.get("Shadow Tone").outputs["Result"], lw.inputs[0])
    xf = k.node("ShaderNodeMath", "x Falloff", label="x falloff", operation="MULTIPLY")
    k.link(lw.outputs[0], xf.inputs[0])
    k.link(k.get("Spot Falloff").outputs["Toon Falloff"], xf.inputs[1])
    ch = k.node("ShaderNodeAttribute", "Channel", label="Light attribute: channel", attribute_type="LIGHT", attribute_name="channel")
    xc = k.node("ShaderNodeVectorMath", "x Channel", label="channel x ·", operation="SCALE")
    k.link(ch.outputs["Vector"], xc.inputs[0])
    k.link(xf.outputs[0], xc.inputs["Scale"])
    k.link(xc.outputs["Vector"], k.get("Light Accumulation").inputs["Diffuse Light"])


def s9_aov(k, tex):
    a = k.node("ShaderNodeOutputAOV", "AOV albedo", label="AOV: toon_albedo", aov_name="toon_albedo")
    k.link(k.get("Color Power").outputs["Vector"], a.inputs["Color"])
    a = k.node("ShaderNodeOutputAOV", "AOV mask", label="AOV: toon_mask", aov_name="toon_mask")
    a.inputs["Value"].default_value = 1.0
    a = k.node("ShaderNodeOutputAOV", "AOV sat", label="AOV: toon_sat", aov_name="toon_sat")
    a.inputs["Value"].default_value = SAT[k.name]


def s9_passes():
    vl = bpy.context.view_layer
    vl.use_pass_diffuse_direct = True
    for nm, typ in (("toon_albedo", "COLOR"), ("toon_mask", "VALUE"), ("toon_sat", "VALUE")):
        if nm not in [a.name for a in vl.aovs]:
            a = vl.aovs.add()
            a.name, a.type = nm, typ


# ------------------------------------------------------------------ compositor
CLAYOUT = {
    "Render Layers": (-1500, 0), "W": (-1200, 300), "R": (-1200, -900), "Image": (-1500, 400),
}


def comp_tree():
    sc = bpy.context.scene
    ct = sc.compositing_node_group
    if ct is None:
        ct = bpy.data.node_groups.new("Toon Compositor", "CompositorNodeTree")
        ct.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        sc.compositing_node_group = ct
    sc.render.use_compositing = True
    return ct


def comp_output(k):
    if not k.has("Group Output"):
        k.node("NodeGroupOutput", "Group Output", (2600, 0))
    return k.get("Group Output").inputs[0]


def comp_insert(k, after_socket, node, in_sock, out_sock):
    """Insert node between after_socket and every input it fed."""
    targets = [l.to_socket for l in k.t.links if l.from_socket == after_socket]
    for t in targets:
        k.link(out_sock, t)
    k.link(after_socket, in_sock)


def light_hd_driver(rgb_node, ob):
    for c in range(3):
        fc = rgb_node.outputs[0].driver_add("default_value", c)
        v = fc.driver.variables.new()
        v.targets[0].id = ob
        v.targets[0].data_path = f'["hd_color"][{c}]'
        fc.driver.expression = v.name


def s9_rebuild():
    ct = comp_tree()
    for nd in list(ct.nodes):
        ct.nodes.remove(nd)
    k = Kit(ct, "comp")
    rl = k.node("CompositorNodeRLayers", "Render Layers", (-1500, 0))
    rl.scene = bpy.context.scene
    w = k.node("CompositorNodeSeparateColor", "W", (-1200, 250), label="per-light weights W")
    k.link(rl.outputs["Diffuse Direct"], w.inputs[0])
    for i, s in enumerate(SPOTS):
        y = 350 - i * 300
        hd = k.node("CompositorNodeRGB", f"hd {i + 1}", (-1000, y - 120), label=f"{s['name']}: hd_color")
        hd.outputs[0].default_value = tuple(s["hd"]) + (1,)
        light_hd_driver(hd, bpy.data.objects[s["name"]])
        ah = k.node("ShaderNodeVectorMath", f"albedo x hd {i + 1}", (-750, y), label="albedo x hd_color", operation="MULTIPLY")
        k.link(rl.outputs["toon_albedo"], ah.inputs[0])
        k.link(hd.outputs[0], ah.inputs[1])
        li = k.node("ShaderNodeVectorMath", f"Light {i + 1}", (-550, y), label=f"x W.{'RGB'[i]} = light {i + 1}", operation="SCALE")
        k.link(ah.outputs[0], li.inputs[0])
        k.link(w.outputs[i], li.inputs["Scale"])
    return k.take()


def s9_max():
    k = Kit(comp_tree(), "comp")
    m1 = k.node("ShaderNodeVectorMath", "Max 12", (-300, 200), label="max(light 1, light 2)", operation="MAXIMUM")
    k.link(k.get("Light 1").outputs[0], m1.inputs[0])
    k.link(k.get("Light 2").outputs[0], m1.inputs[1])
    m2 = k.node("ShaderNodeVectorMath", "Max 123", (-100, 100), label="max(·, light 3)", operation="MAXIMUM")
    k.link(m1.outputs[0], m2.inputs[0])
    k.link(k.get("Light 3").outputs[0], m2.inputs[1])
    k.link(m2.outputs[0], comp_output(k))
    return k.take()


def s9_mask():
    k = Kit(comp_tree(), "comp")
    mm = k.node("ShaderNodeMix", "Toon over Image", (540, 150), label="Image → toon, by toon_mask", data_type="RGBA", blend_type="MIX", clamp_factor=True)
    k.link(k.get("Render Layers").outputs["toon_mask"], mm.inputs[0])
    k.link(k.get("Render Layers").outputs["Image"], mm.inputs[A])
    k.link(k.get("Max 123").outputs[0], mm.inputs[B])
    k.link(mm.outputs["Result"], comp_output(k))
    for scr in bpy.data.screens:
        for area in scr.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.shading.use_compositor = "ALWAYS"
    return k.take()


def s9_saturation():
    k = Kit(comp_tree(), "comp")
    mx = k.get("Max 123").outputs[0]
    sm = k.node("ShaderNodeMix", "Saturation", (320, 150), label="lerp(luma, colour, toon_sat)", data_type="RGBA", blend_type="MIX", clamp_factor=False)
    comp_insert(k, mx, sm, sm.inputs[B], sm.outputs["Result"])
    lu = k.node("ShaderNodeVectorMath", "Luma", (100, 300), label="· (0.2127, 0.7152, 0.0722) = luma", operation="DOT_PRODUCT")
    lu.inputs[1].default_value = (0.2126729, 0.7151522, 0.0721750)
    k.link(mx, lu.inputs[0])
    k.link(k.get("Render Layers").outputs["toon_sat"], sm.inputs[0])
    k.link(lu.outputs["Value"], sm.inputs[A])
    return k.take()


# ================================================================== step 10: sweater normal map + rim
def normal_group():
    """Tangent-space normal map decoded by hand with Unity's tangent frame (uT, uB attributes)."""
    g = bpy.data.node_groups.get("Unity Normal Map")
    if g:
        return g
    g = bpy.data.node_groups.new("Unity Normal Map", "ShaderNodeTree")
    g.interface.new_socket("Color", in_out="INPUT", socket_type="NodeSocketColor")
    g.interface.new_socket("Normal", in_out="OUTPUT", socket_type="NodeSocketVector")
    k = Kit(g, "Unity Normal Map")
    gi = k.node("NodeGroupInput", "Group Input", (-1100, 0))
    xy = k.node("ShaderNodeVectorMath", "xy", (-900, 0), label="x 2 − 1 (xy only)", operation="MULTIPLY_ADD")
    xy.inputs[1].default_value = (2.0, 2.0, 0.0)
    xy.inputs[2].default_value = (-1.0, -1.0, 0.0)
    k.link(gi.outputs["Color"], xy.inputs[0])
    l2 = k.node("ShaderNodeVectorMath", "len2", (-700, -200), label="x² + y²", operation="DOT_PRODUCT")
    k.link(xy.outputs[0], l2.inputs[0])
    k.link(xy.outputs[0], l2.inputs[1])
    om = k.node("ShaderNodeMath", "1 - len2", (-520, -200), label="1 − · (clamp)", operation="SUBTRACT", use_clamp=True)
    om.inputs[0].default_value = 1.0
    k.link(l2.outputs["Value"], om.inputs[1])
    z = k.node("ShaderNodeMath", "z", (-340, -200), label="√ = z", operation="SQRT")
    k.link(om.outputs[0], z.inputs[0])
    sp = k.node("ShaderNodeSeparateXYZ", "split", (-700, 150))
    k.link(xy.outputs[0], sp.inputs[0])
    geo = k.node("ShaderNodeNewGeometry", "Geometry", (-700, -450))
    at = k.node("ShaderNodeAttribute", "uT", (-520, 400), label="Attribute: uT (tangent)", attribute_name="uT")
    ab = k.node("ShaderNodeAttribute", "uB", (-520, 150), label="Attribute: uB (bitangent)", attribute_name="uB")
    tx = k.node("ShaderNodeVectorMath", "T x", (-280, 350), label="T · x", operation="SCALE")
    k.link(at.outputs["Vector"], tx.inputs[0])
    k.link(sp.outputs["X"], tx.inputs["Scale"])
    by = k.node("ShaderNodeVectorMath", "B y", (-280, 120), label="B · y", operation="SCALE")
    k.link(ab.outputs["Vector"], by.inputs[0])
    k.link(sp.outputs["Y"], by.inputs["Scale"])
    nz = k.node("ShaderNodeVectorMath", "N z", (-140, -300), label="N · z", operation="SCALE")
    k.link(geo.outputs["Normal"], nz.inputs[0])
    k.link(z.outputs[0], nz.inputs["Scale"])
    s1 = k.node("ShaderNodeVectorMath", "add1", (-60, 250), label="+", operation="ADD")
    k.link(tx.outputs[0], s1.inputs[0])
    k.link(by.outputs[0], s1.inputs[1])
    s2 = k.node("ShaderNodeVectorMath", "add2", (120, 100), label="+", operation="ADD")
    k.link(s1.outputs[0], s2.inputs[0])
    k.link(nz.outputs[0], s2.inputs[1])
    nn = k.node("ShaderNodeVectorMath", "normalize", (300, 100), label="normalize", operation="NORMALIZE")
    k.link(s2.outputs[0], nn.inputs[0])
    go = k.node("NodeGroupOutput", "Group Output", (480, 100))
    k.link(nn.outputs[0], go.inputs["Normal"])
    return g


def s10_normal(k, tex):
    nt = k.node("ShaderNodeTexImage", "Normal Texture", label="Sweater_Normal (Non-Color)", image=image("Sweater_Normal.jpg", "Non-Color"))
    nm = k.node("ShaderNodeGroup", "Normal Map", label="Unity Normal Map")
    nm.node_tree = normal_group()
    k.link(nt.outputs["Color"], nm.inputs["Color"])
    k.link(nm.outputs["Normal"], k.get("Dot Product").inputs[0])
    k.link(nm.outputs["Normal"], k.get("Matcap Normal").inputs["Vector"])


def s10_rim(k, tex):
    nv = k.node("ShaderNodeVectorMath", "N.V", label="N · V", operation="DOT_PRODUCT")
    k.link(normal_socket(k), nv.inputs[0])
    k.link(k.get("Geometry").outputs["Incoming"], nv.inputs[1])
    om = k.node("ShaderNodeMath", "1 - N.V", label="1 − N·V (clamp)", operation="SUBTRACT", use_clamp=True)
    om.inputs[0].default_value = 1.0
    k.link(nv.outputs["Value"], om.inputs[1])
    pw = k.node("ShaderNodeMath", "Rim Power", label="(·)^1.26", operation="POWER")
    pw.inputs[1].default_value = RIM["power"]
    k.link(om.outputs[0], pw.inputs[0])
    re = k.node("ShaderNodeMapRange", "Rim Edge", label="smoothstep(−0.083, 0.759, ·)", interpolation_type="SMOOTHSTEP", clamp=True)
    re.inputs["From Min"].default_value = RIM["threshold"] - RIM["softness"]
    re.inputs["From Max"].default_value = RIM["threshold"] + RIM["softness"]
    k.link(pw.outputs[0], re.inputs["Value"])


def s10_rimpack(k, tex):
    rs = k.node("ShaderNodeMath", "Rim x Shade", label="x shade", operation="MULTIPLY")
    k.link(k.get("Rim Edge").outputs["Result"], rs.inputs[0])
    k.link(k.get("Shadow Strength").outputs["Value"], rs.inputs[1])
    rf = k.node("ShaderNodeMath", "Rim x Falloff", label="x falloff", operation="MULTIPLY")
    k.link(rs.outputs[0], rf.inputs[0])
    k.link(k.get("Spot Falloff").outputs["Toon Falloff"], rf.inputs[1])
    rc = k.node("ShaderNodeVectorMath", "Rim x Channel", label="channel x ·", operation="SCALE")
    k.link(k.get("Channel").outputs["Vector"], rc.inputs[0])
    k.link(rf.outputs[0], rc.inputs["Scale"])
    acc = k.get("Light Accumulation")
    k.link(rc.outputs["Vector"], acc.inputs["Glossy Light"])
    acc.inputs["Glossy Color"].default_value = (1, 1, 1, 1)  # a black lobe is skipped, and its pass stays empty
    rk = RIM["intensity"]
    a = k.node("ShaderNodeOutputAOV", "AOV rimA", label="AOV: toon_rimA", aov_name="toon_rimA")
    a.inputs["Color"].default_value = tuple(0.65 * rk * c for c in RIM["color"]) + (1,)
    a = k.node("ShaderNodeOutputAOV", "AOV rimB", label="AOV: toon_rimB", aov_name="toon_rimB")
    a.inputs["Color"].default_value = tuple(0.35 * LIGHT_INTENSITY * rk * c for c in RIM["color"]) + (1,)


def s10_passes():
    vl = bpy.context.view_layer
    vl.use_pass_glossy_direct = True
    for nm in ("toon_rimA", "toon_rimB"):
        if nm not in [a.name for a in vl.aovs]:
            a = vl.aovs.add()
            a.name, a.type = nm, "COLOR"


def s10_comp():
    k = Kit(comp_tree(), "comp")
    rl = k.get("Render Layers")
    r = k.node("CompositorNodeSeparateColor", "R", (-1200, -750), label="per-light rim weights R")
    k.link(rl.outputs["Glossy Direct"], r.inputs[0])
    for i in range(3):
        y = 350 - i * 300
        hd = k.get(f"hd {i + 1}")
        rb = k.node("ShaderNodeVectorMath", f"rimB x hd {i + 1}", (-1000, -700 - i * 220), label="rimB x hd_color", operation="MULTIPLY")
        k.link(rl.outputs["toon_rimB"], rb.inputs[0])
        k.link(hd.outputs[0], rb.inputs[1])
        ra = k.node("ShaderNodeVectorMath", f"rim colour {i + 1}", (-800, -700 - i * 220), label="+ rimA", operation="ADD")
        k.link(rl.outputs["toon_rimA"], ra.inputs[0])
        k.link(rb.outputs[0], ra.inputs[1])
        rw = k.node("ShaderNodeVectorMath", f"rim {i + 1}", (-600, -700 - i * 220), label=f"x R.{'RGB'[i]}", operation="SCALE")
        k.link(ra.outputs[0], rw.inputs[0])
        k.link(r.outputs[i], rw.inputs["Scale"])
        li = k.get(f"Light {i + 1}")
        ad = k.node("ShaderNodeVectorMath", f"Light {i + 1} + rim", (-380, y - 60), label=f"light {i + 1} + rim", operation="ADD")
        for l in [l for l in k.t.links if l.from_socket == li.outputs[0]]:
            k.link(ad.outputs[0], l.to_socket)
        k.link(li.outputs[0], ad.inputs[0])
        k.link(rw.outputs[0], ad.inputs[1])
    return k.take()


# ================================================================== step 11: the Unity shot, fog, depth of field
def s11_camera():
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("Shot Camera")
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(SHOT["fov_y"])
    cd.clip_start, cd.clip_end = SHOT["near"], 1000
    cam = bpy.data.objects.new("Shot Camera", cd)
    sc.collection.objects.link(cam)
    f, up = SHOT["fwd"], SHOT["up"]
    right = f.cross(up).normalized()
    up = right.cross(f).normalized()
    cam.matrix_world = Matrix.Translation(SHOT["pos"]) @ Matrix((right, up, -f)).transposed().to_4x4()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = SHOT["res"]
    vl = bpy.context.view_layer
    vl.use_pass_z = True
    vl.use_pass_position = True


def fog_group():
    g = bpy.data.node_groups.get("HDRP Height Fog")
    if g:
        return g
    g = bpy.data.node_groups.new("HDRP Height Fog", "CompositorNodeTree")
    g.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketColor")
    g.interface.new_socket("Position", in_out="INPUT", socket_type="NodeSocketVector")
    g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    k = Kit(g, "fog")
    gi = k.node("NodeGroupInput", "Group Input", (-1300, 0))
    cam_pos = SHOT["pos"]
    Hs = (FOG["maxh"] - FOG["base"]) * 0.144765

    def m(name, op, loc, a=None, b=None, label=None):
        nd = k.node("ShaderNodeMath", name, loc, label=label, operation=op)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                k.link(v, nd.inputs[i])
            else:
                nd.inputs[i].default_value = v
        return nd.outputs[0]

    dv = k.node("ShaderNodeVectorMath", "ray", (-1100, -100), label="position − camera", operation="SUBTRACT")
    k.link(gi.outputs["Position"], dv.inputs[0])
    dv.inputs[1].default_value = tuple(cam_pos)
    ln = k.node("ShaderNodeVectorMath", "t", (-900, 0), label="length t", operation="LENGTH")
    k.link(dv.outputs[0], ln.inputs[0])
    dz = k.node("ShaderNodeVectorMath", "rise", (-900, -200), label="· (0,0,1) = rise", operation="DOT_PRODUCT")
    k.link(dv.outputs[0], dz.inputs[0])
    dz.inputs[1].default_value = (0, 0, 1)
    t = ln.outputs["Value"]
    cosz = m("cos", "DIVIDE", (-700, -200), dz.outputs["Value"], m("t safe", "MAXIMUM", (-700, -50), t, 1e-6, label="max(t, ε)"), label="rise / t")
    tc = m("t clip", "MINIMUM", (-700, 150), t, FOG["maxd"], label="min(t, 70)")
    kk = m("k", "DIVIDE", (-500, -50), m("tc cos", "MULTIPLY", (-500, 150), tc, cosz, label="x"), Hs, label="/ H")
    kk = m("k safe", "MAXIMUM", (-300, -50), kk, 1e-4, label="max(·, ε)")
    e = m("exp -k", "EXPONENT", (-100, -150), m("-k", "MULTIPLY", (-300, -200), kk, -1.0, label="x −1"), label="e^(·)")
    ff = m("ff", "DIVIDE", (100, -50), m("1-e", "SUBTRACT", (100, -200), 1.0, e, label="1 − ·"), kk, label="/ k")
    od = m("od", "MULTIPLY", (300, 50), m("tc ff", "MULTIPLY", (300, -100), tc, ff, label="x t"),
           (1.0 / FOG["mfp"]) * math.exp(-(cam_pos.z - FOG["base"]) / Hs), label="x density at camera")
    tr = m("T", "EXPONENT", (500, 50), m("-od", "MULTIPLY", (500, -100), od, -1.0, label="x −1"), label="transmittance e^(−·)")
    sc_ = k.node("ShaderNodeVectorMath", "attenuate", (700, 150), label="image x T", operation="SCALE")
    k.link(gi.outputs["Image"], sc_.inputs[0])
    k.link(tr, sc_.inputs["Scale"])
    go = k.node("NodeGroupOutput", "Group Output", (900, 150))
    k.link(sc_.outputs[0], go.inputs[0])
    return g


def s11_fog():
    k = Kit(comp_tree(), "comp")
    fg = k.node("CompositorNodeGroup", "Height Fog", (800, 150), label="HDRP Height Fog")
    fg.node_tree = fog_group()
    comp_insert(k, k.get("Toon over Image").outputs["Result"], fg, fg.inputs["Image"], fg.outputs[0])
    k.link(k.get("Render Layers").outputs["Position"], fg.inputs["Position"])
    return k.take()


def s11_dof():
    k = Kit(comp_tree(), "comp")
    z = k.get("Render Layers").outputs["Depth"]
    radius = DOF["radius_1080"] * SHOT["res"][1] / 1080.0
    a = k.node("ShaderNodeMath", "z - near", (700, -300), label="depth − 1.68", operation="SUBTRACT")
    a.inputs[1].default_value = DOF["near"]
    k.link(z, a.inputs[0])
    b = k.node("ShaderNodeMath", "coc01", (880, -300), label="/ 0.32 (clamp)", operation="DIVIDE", use_clamp=True)
    b.inputs[1].default_value = DOF["far"] - DOF["near"]
    k.link(a.outputs[0], b.inputs[0])
    c = k.node("ShaderNodeMath", "CoC", (1060, -300), label=f"x {radius:.2f} px = blur radius", operation="MULTIPLY")
    c.inputs[1].default_value = radius
    k.link(b.outputs[0], c.inputs[0])
    bk = k.node("CompositorNodeBokehImage", "Bokeh Image", (1060, -550))
    bk.inputs["Flaps"].default_value = 5
    bk.inputs["Roundness"].default_value = 1.0
    bb = k.node("CompositorNodeBokehBlur", "Depth of Field", (1300, 150), label="Bokeh Blur")
    comp_insert(k, k.get("Height Fog").outputs[0], bb, bb.inputs["Image"], bb.outputs[0])
    k.link(bk.outputs[0], bb.inputs["Bokeh"])
    k.link(c.outputs[0], bb.inputs["Size"])
    return k.take()


# ================================================================== step 12: finish
def s12_ao():
    vl = bpy.context.view_layer
    vl.use_pass_ambient_occlusion = True
    vl.eevee.ambient_occlusion_distance = AO_DIST
    k = Kit(comp_tree(), "comp")
    p = k.node("ShaderNodeMath", "AO^2", (560, -150), label="AO²", operation="POWER")
    p.inputs[1].default_value = AO_POWER
    k.link(k.get("Render Layers").outputs["Ambient Occlusion"], p.inputs[0])
    t = k.node("ShaderNodeMix", "AO colour", (700, -100), label="lerp(SSAO colour, white, AO²)", data_type="RGBA", blend_type="MIX", clamp_factor=True)
    t.inputs[A].default_value = SSAO_COLOR + (1,)
    t.inputs[B].default_value = (1, 1, 1, 1)
    k.link(p.outputs[0], t.inputs[0])
    x = k.node("ShaderNodeMix", "AO Tint", (700, 150), label="x tint, toon pixels only", data_type="RGBA", blend_type="MULTIPLY", clamp_factor=True)
    k.link(k.get("Render Layers").outputs["toon_mask"], x.inputs[0])
    k.link(t.outputs["Result"], x.inputs[B])
    comp_insert(k, k.get("Toon over Image").outputs["Result"], x, x.inputs[A], x.outputs["Result"])
    for nd in ("Height Fog", "Depth of Field", "z - near", "coc01", "CoC", "Bokeh Image", "Group Output"):
        n = k.get(nd)
        n.location = (n.location[0] + 250, n.location[1])
    return k.take()


def vignette_group():
    g = bpy.data.node_groups.get("HDRP Vignette")
    if g:
        return g
    g = bpy.data.node_groups.new("HDRP Vignette", "CompositorNodeTree")
    g.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketColor")
    g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    k = Kit(g, "vig")
    gi = k.node("NodeGroupInput", "Group Input", (-1100, 0))
    ic = k.node("CompositorNodeImageCoordinates", "Image Coordinates", (-900, 0))
    k.link(gi.outputs["Image"], ic.inputs[0])

    def m(name, op, loc, a=None, b=None, label=None, clamp=False):
        nd = k.node("ShaderNodeMath", name, loc, label=label, operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                k.link(v, nd.inputs[i])
            else:
                nd.inputs[i].default_value = v
        return nd.outputs[0]

    sq = []
    for i, ax in enumerate("xy"):
        y = 200 - i * 300
        sp = k.node("ShaderNodeVectorMath", ax, (-650, y), label=f"{ax} (0…1)", operation="DOT_PRODUCT")
        k.link(ic.outputs["Normalized"], sp.inputs[0])
        sp.inputs[1].default_value = (1.0, 0, 0) if i == 0 else (0, 1.0, 0)
        d = m(ax + " -0.5", "SUBTRACT", (-450, y), sp.outputs["Value"], 0.5, label="− 0.5")
        d = m(ax + " abs", "ABSOLUTE", (-270, y), d, label="|·|")
        d = m(ax + " x1.5", "MULTIPLY", (-90, y), d, 1.5, label="x 1.5 (clamp)", clamp=True)
        d = m(ax + " ^4.75", "POWER", (90, y), d, 4.75, label="(·)^4.75")
        sq.append(m(ax + " sq", "MULTIPLY", (270, y), d, d, label="(·)²"))
    s = m("sum", "ADD", (450, 50), sq[0], sq[1], label="+")
    v = m("1-sum", "SUBTRACT", (630, 50), 1.0, s, label="1 − · (clamp)", clamp=True)
    v = m("vf", "POWER", (810, 50), v, 5.0, label="(·)⁵ = vignette")
    sc_ = k.node("ShaderNodeVectorMath", "darken", (990, 150), label="image x vignette", operation="SCALE")
    k.link(gi.outputs["Image"], sc_.inputs[0])
    k.link(v, sc_.inputs["Scale"])
    go = k.node("NodeGroupOutput", "Group Output", (1170, 150))
    k.link(sc_.outputs[0], go.inputs[0])
    return g


def s12_vignette():
    k = Kit(comp_tree(), "comp")
    vg = k.node("CompositorNodeGroup", "Vignette", (1800, 150), label="HDRP Vignette")
    vg.node_tree = vignette_group()
    comp_insert(k, k.get("Depth of Field").outputs[0], vg, vg.inputs["Image"], vg.outputs[0])
    return k.take()


M_S2AP0 = [[0.4397010, 0.3829780, 0.1773350], [0.0897923, 0.8134230, 0.0967616], [0.0175440, 0.1115440, 0.8707040]]
M_AP0AP1 = [[1.4514393161, -0.2365107469, -0.2149285693], [-0.0765537734, 1.1762296998, -0.0996759264], [0.0083161484, -0.0060324498, 0.9977163014]]
M_AP1S = [[1.70505, -0.62179, -0.08326], [-0.13026, 1.14080, -0.01055], [-0.02400, -0.12897, 1.15297]]
AP1_LUMA = (0.2722287, 0.6740818, 0.0536895)


def grade_group():
    g = bpy.data.node_groups.get("HDRP Color Adjustments")
    if g:
        return g
    g = bpy.data.node_groups.new("HDRP Color Adjustments", "CompositorNodeTree")
    g.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketColor")
    g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    k = Kit(g, "grade")
    gi = k.node("NodeGroupInput", "Group Input", (-1400, 0))

    def vm(name, op, loc, a, b=None, label=None, scale=None):
        nd = k.node("ShaderNodeVectorMath", name, loc, label=label, operation=op)
        k.link(a, nd.inputs[0])
        if b is not None:
            if isinstance(b, bpy.types.NodeSocket):
                k.link(b, nd.inputs[1])
            else:
                nd.inputs[1].default_value = b
        if scale is not None:
            nd.inputs["Scale"].default_value = scale
        return nd.outputs[0] if op not in ("DOT_PRODUCT",) else nd.outputs["Value"]

    def mat3(col, M, x, label):
        cb = k.node("ShaderNodeCombineXYZ", label + " out", (x + 200, -0), label=label)
        for i in range(3):
            d = vm(f"{label} row {i}", "DOT_PRODUCT", (x, 200 - i * 200), col, tuple(M[i]), label=f"· row {i + 1}")
            k.link(d, cb.inputs[i])
        return cb.outputs[0]

    x = vm("exposure", "SCALE", (-1200, 0), gi.outputs["Image"], label="x 2^0.3 (post exposure)", scale=2 ** GRADE["post_exposure"])
    x = mat3(x, M_S2AP0, -1000, "sRGB → ACES AP0")
    x = vm("pos", "MAXIMUM", (-550, 0), x, (0, 0, 0), label="max(·, 0)")
    x = vm("/0.18", "SCALE", (-370, 0), x, label="/ 0.18", scale=1 / 0.18)
    x = vm("contrast", "POWER", (-190, 0), x, (GRADE["contrast"],) * 3, label="^0.9 (contrast −10)")
    x = vm("x0.18", "SCALE", (-10, 0), x, label="x 0.18", scale=0.18)
    x = mat3(x, M_AP0AP1, 170, "AP0 → AP1")
    lu = vm("AP1 luma", "DOT_PRODUCT", (620, -250), x, AP1_LUMA, label="AP1 luma")
    sm = k.node("ShaderNodeMix", "saturation", (800, 0), label="lerp(luma, ·, 1.03)", data_type="RGBA", blend_type="MIX", clamp_factor=False)
    sm.inputs[0].default_value = GRADE["saturation"]
    k.link(lu, sm.inputs[A])
    k.link(x, sm.inputs[B])
    x = mat3(sm.outputs["Result"], M_AP1S, 1000, "AP1 → sRGB")
    go = k.node("NodeGroupOutput", "Group Output", (1450, 0))
    k.link(x, go.inputs[0])
    return g


def s12_grade():
    k = Kit(comp_tree(), "comp")
    gg = k.node("CompositorNodeGroup", "Color Adjustments", (2050, 150), label="HDRP Color Adjustments")
    gg.node_tree = grade_group()
    comp_insert(k, k.get("Vignette").outputs[0], gg, gg.inputs["Image"], gg.outputs[0])
    k.get("Group Output").location = (2300, 150)
    return k.take()


def s12_aces():
    bpy.context.scene.view_settings.view_transform = "ACES 1.3"


# ================================================================== step table
S = Sub
STEPS = {
    1: [S("s1_world", s1_world, "scene", ("props", "WORLD", None, "", None)),
        S("s1_viewtransform", s1_view, "scene", ("props", "RENDER", None, "View Transform", "CM")),
        S("s1_sunprops", s1_sun, "scene", ("props", "DATA", "Sun", "", None)),
        S("s1_diffuse", s1_diffuse), S("s1_texture", s1_texture)],
    2: [S("s2_measure", s2_measure), S("s2_ramp", s2_ramp), S("s2_texture", s2_texture),
        S("s2_emission", s2_emission), S("s2_pink", s2_pink, "scene", None)],
    3: [S("s3_dot", s3_dot), S("s3_remap", s3_remap), S("s3_ramp", s3_ramp),
        S("s3_lightcolor", s3_lightcolor), S("s3_accumulate", s3_accumulate)],
    4: [S("s4_edge", s4_edge), S("s4_strength", s4_strength), S("s4_tone", s4_tone)],
    5: [S("s5_raycast", s5_raycast), S("s5_combine", s5_combine)],
    6: [S("s6_uv", s6_uv), S("s6_lookup", s6_lookup), S("s6_albedo", s6_albedo)],
    7: [S("s7_cull", s7_cull, "scene", ("props", "MATERIAL", "Body", "Backface", None)),
        S("s7_material", s7_material, "scene", ("nodes", "Outline")),
        S("s7_hull", s7_hull, "scene", ("geo", "Body_Outline")),
        S("s7_sweater", s7_sweater, "scene", ("props", "MODIFIER", "Sweater_Outline", "", None))],
    8: [S("s8_lights", s8_lights, "scene", ("props", "OBJECT", "Spot Light (2)", "", "CUSTOM")),
        S("s8_group", s8_group, "scene", ("group", "HDRP Spot Falloff", "Floor")),
        S("s8_floor", s8_floor, "floor", ("nodes", "Floor")),
        S("s8_lightcolor", s8_lightcolor), S("s8_falloff", s8_falloff), S("s8_colorpower", s8_colorpower)],
    9: [S("s9_cap", s9_cap), S("s9_pack", s9_pack), S("s9_aov", s9_aov),
        S("s9_passes", s9_passes, "scene", ("props", "VIEW_LAYER", None, "", None)),
        S("s9_rebuild", s9_rebuild, "scene", ("comp",)), S("s9_max", s9_max, "scene", ("comp",)),
        S("s9_mask", s9_mask, "scene", ("comp",)), S("s9_saturation", s9_saturation, "scene", ("comp",))],
    10: [S("s10_normal", s10_normal, "sweater"), S("s10_rim", s10_rim, "sweater"),
         S("s10_rimpack", s10_rimpack, "sweater"), S("s10_passes", s10_passes, "scene", None),
         S("s10_comp", s10_comp, "scene", ("comp",))],
    11: [S("s11_camera", s11_camera, "scene", ("props", "DATA", "Shot Camera", "", None)),
         S("s11_fog", s11_fog, "scene", ("comp",)), S("s11_fog_group", lambda: set(), "scene", ("cgroup", "Height Fog")),
         S("s11_dof", s11_dof, "scene", ("comp",))],
    12: [S("s12_ao", s12_ao, "scene", ("comp",)), S("s12_vignette", s12_vignette, "scene", ("comp",)),
         S("s12_grade", s12_grade, "scene", ("comp",)), S("s12_grade_group", lambda: set(), "scene", ("cgroup", "Color Adjustments")),
         S("s12_aces", s12_aces, "scene", ("props", "RENDER", None, "View Transform", "CM"))],
}
LAST = max(STEPS)


def iter_step(n):
    """Apply step n one sub-step at a time; yield (sub, touched node names on the shot target)."""
    tex = textures()
    for sub in STEPS[n]:
        touched = set()
        if sub.on in ("mats", "sweater"):
            names = ("Skin", "Sweater") if sub.on == "mats" else ("Sweater",)
            for nm in names:
                k = Kit(bpy.data.materials[nm], nm)
                sub.fn(k, tex[nm])
                t = k.take()
                if nm == names[0]:
                    touched = t
        elif sub.on == "floor":
            k = Kit(bpy.data.materials["Floor"], "Floor")
            sub.fn(k)
            touched = k.take()
        else:
            touched = sub.fn() or set()
        yield sub, touched


def run_step(n):
    for _ in iter_step(n):
        pass


def build_to(n):
    base_scene()
    for i in range(1, n + 1):
        run_step(i)
