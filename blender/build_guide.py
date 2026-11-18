"""Build the guide's Blender files, web assets and reference renders.

  blender -b --factory-startup --python build_guide.py
Writes web/public/blend/stepN.blend, web/public/assets/*, web/public/ref/*.png, web/src/generated/scene.json.
GUIDE_ONLY_REF=1 skips assets and .blend files; GUIDE_STEPS="4,5" limits which steps are rebuilt.
"""
import bpy, json, math, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guide_lib as G

BLEND = os.path.join(G.PUB, "blend")
ASSETS = os.path.join(G.PUB, "assets")
REF = os.path.join(G.PUB, "ref")
GEN = os.path.join(G.WEB, "src", "generated")
for d in (BLEND, ASSETS, REF, GEN):
    os.makedirs(d, exist_ok=True)
ONLY_REF = os.environ.get("GUIDE_ONLY_REF") == "1"
ONLY = [int(s) for s in os.environ["GUIDE_STEPS"].split(",")] if os.environ.get("GUIDE_STEPS") else None


def save_png(im, path, size=None):
    _ = im.size[0]  # touching size loads the pixels; save() fails on an unloaded image
    if size:
        im.scale(*size)
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()


# ---------------------------------------------------------------- web assets (mesh + textures)
if not ONLY_REF:
    G.base_scene()
    me = bpy.data.objects["Sweater"].data  # glTF exports custom attributes only when they start with "_"
    for nm in ("uT", "uB"):
        src = me.attributes[nm]
        vals = [0.0] * (len(src.data) * 3)
        src.data.foreach_get("vector", vals)
        me.attributes.new("_" + nm, "FLOAT_VECTOR", "POINT").data.foreach_set("vector", vals)
    bpy.ops.object.select_all(action="DESELECT")
    for nm in ("Body", "Sweater", "Floor"):
        bpy.data.objects[nm].select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS, "character.glb"), export_format="GLB",
                              use_selection=True, export_materials="NONE", export_normals=True,
                              export_texcoords=True, export_tangents=False, export_yup=True, export_morph=False,
                              export_cameras=False, export_lights=False, export_attributes=True)
    save_png(bpy.data.images.load(os.path.join(G.TEX, "body_Color.png")), os.path.join(ASSETS, "body_color.png"), (2048, 2048))
    shutil.copy(os.path.join(G.TEX, "Sweater_Color.jpg"), os.path.join(ASSETS, "sweater_color.jpg"))
    shutil.copy(os.path.join(G.TEX, "Sweater_Normal.jpg"), os.path.join(ASSETS, "sweater_normal.jpg"))
    save_png(bpy.data.images.load(os.path.join(G.TEX, "spheremapSkin.psd")), os.path.join(ASSETS, "matcap.png"))
    save_png(bpy.data.images.load(os.path.join(G.TEX, "out_line_mask.png")), os.path.join(ASSETS, "outline_mask.png"), (1024, 1024))

# ---------------------------------------------------------------- step files + reference renders
# (render name, show pink sun). Keys are sub-step keys (render right after it) or "end".
REFS = {
    0: {"end": [("s0_dark", False)]},
    1: {"end": [("s1_sun", False)]},
    2: {"end": [("s2_toon", False), ("s2_two", True)]},
    3: {"end": [("s3_toon", False), ("s3_two", True)]},
    4: {"end": [("s4_toon", False), ("s4_two", True)]},
    5: {"end": [("s5_toon", False), ("s5_two", True)]},
    6: {"end": [("s6_toon", False), ("s6_two", True)]},
    7: {"end": [("s7_toon", False), ("s7_two", True)]},
    8: {"s8_falloff": [("s8_hot", False)], "end": [("s8_sum", False)]},
    9: {"s9_cap": [("s9_cap", False)], "s9_mask": [("s9_max", False)], "end": [("s9_sat", False)]},
    10: {"end": [("s10_rim", False)]},
    11: {"s11_camera": [("s11_cam", False)], "s11_fog": [("s11_fog", False)], "end": [("s11_dof", False)]},
    12: {"s12_ao": [("s12_ao", False)], "s12_grade": [("s12_grade", False)], "end": [("s12_final", False)]},
}


def render(name, pink):
    sc = bpy.context.scene
    p = bpy.data.objects.get("Pink Sun")
    if p:
        p.hide_render = not pink
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.filepath = os.path.join(REF, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("## ref", name)
    if p:
        p.hide_render = True


steps = ONLY or list(range(0, G.LAST + 1))
for step in steps:
    G.build_to(step - 1) if step > 0 else G.base_scene()
    if step > 0:
        for sub, _ in G.iter_step(step):
            for nm, pink in REFS[step].get(sub.key, []):
                render(nm, pink)
    if not ONLY_REF:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND, f"step{step}.blend"))
        print("## saved step", step)
    for nm, pink in REFS[step]["end"]:
        render(nm, pink)
for f in os.listdir(BLEND):
    if f.endswith(".blend1"):
        os.remove(os.path.join(BLEND, f))

# ---------------------------------------------------------------- shared numbers for the website
T = G.to_three
cam = dict(pos=T(G.CAM["pos"]), target=T(G.CAM["target"]), fovY=G.CAM["fov_y"], width=G.RES[0], height=G.RES[1])
sf, su = G.SHOT["fwd"], G.SHOT["up"]
shot = dict(pos=T(G.SHOT["pos"]), target=T(G.SHOT["pos"] + sf * 1.9), up=T(su), fovY=G.SHOT["fov_y"],
            width=G.SHOT["res"][0], height=G.SHOT["res"][1])
data = dict(
    camera=cam, shot=shot,
    lights=[dict(name=c["name"], dir=T(c["L"]), color=list(c["color"]), strength=c["strength"]) for c in (G.SUN1, G.SUN2)],
    spots=[dict(name=s["name"], pos=T(s["pos"]), fwd=T(s["fwd"]), hd=list(s["hd"]), outer=s["outer"],
                angleScale=s["angle_scale"], angleOffset=s["angle_offset"], rangeScale=s["range_scale"]) for s in G.SPOTS],
    shadowGrey=G.SHADOW_GREY, floorGrey=G.FLOOR_GREY, floorEmit=list(G.FLOOR_EMIT),
    rampS2=G.RAMP_S2, rampS3=G.RAMP_S3, celLo=G.CEL_LO, celHi=G.CEL_HI, selfShadow=G.SELF_SHADOW,
    lightIntensity=G.LIGHT_INTENSITY, colorPower=G.COLOR_POWER, litCap=G.LIT_CAP, matcapInt=G.MATCAP_INT,
    outlineWidth=G.OUTLINE_WIDTH, sat=G.SAT, rim=G.RIM, ssaoColor=list(G.SSAO_COLOR), fog=G.FOG,
    shotCamPos=T(G.SHOT["pos"]), grade=G.GRADE, sunAngleDeg=0.5,
    mS2AP0=G.M_S2AP0, mAP0AP1=G.M_AP0AP1, mAP1S=G.M_AP1S, ap1Luma=list(G.AP1_LUMA),
)
json.dump(data, open(os.path.join(GEN, "scene.json"), "w"), indent=1)
print("## wrote scene.json")
