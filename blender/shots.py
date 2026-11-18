"""Capture Blender UI screenshots for the guide. Needs a real window (not -b):

  blender --factory-startup --enable-event-simulate --window-geometry 0 0 1700 1050 --python shots.py
GUIDE_SHOTS="4,5" limits the steps (default: all). Writes web/public/shots/*.png, then quits.
Each sub-step's Sub.shot says what to capture right after it ran (see guide_lib.Sub).
"""
import bpy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guide_lib as G

OUT = os.path.join(G.PUB, "shots")
os.makedirs(OUT, exist_ok=True)
ONLY = os.environ.get("GUIDE_SHOTS")
CM_HEADER_FROM_TOP = int(os.environ.get("GUIDE_CM_Y", "535"))
NO_VIEWPORT = os.environ.get("GUIDE_NO_VIEWPORT") == "1"


def win():
    return bpy.context.window_manager.windows[0]


def area(kind):
    return max((a for a in win().screen.areas if a.type == kind), key=lambda a: a.width * a.height)


def main_region(a):
    return next(r for r in a.regions if r.type == "WINDOW")


def shoot(a, name):
    with bpy.context.temp_override(window=win(), area=a, region=main_region(a)):
        bpy.ops.screen.screenshot_area(filepath=os.path.join(OUT, name + ".png"))
    print("## shot", name, a.width, a.height)


def ev(type, value, x, y):
    win().event_simulate(type, value, x=int(x), y=int(y))


def click(x, y):
    ev("MOUSEMOVE", "NOTHING", x, y)
    ev("LEFTMOUSE", "PRESS", x, y)
    ev("LEFTMOUSE", "RELEASE", x, y)


def editor(a, ui_type, tree, group_node=None):
    """Show `tree` in area a (pinned), optionally entered into group_node's group."""
    a.ui_type = ui_type
    sp = a.spaces.active
    sp.show_region_ui = False
    sp.show_region_toolbar = False
    sp.pin = True
    sp.node_tree = tree
    if group_node is not None:
        sp.path.append(group_node.node_tree, node=group_node)
    return sp


def select(tree, names):
    for nd in tree.nodes:
        nd.select = nd.name in names
    if names:
        tree.nodes.active = tree.nodes[sorted(names)[0]]


def frame(a, selected):
    with bpy.context.temp_override(window=win(), area=a, region=main_region(a)):
        if selected:
            bpy.ops.node.view_selected()
            bpy.ops.view2d.zoom_out()  # leave a margin so the wires into the framed nodes show
        else:
            bpy.ops.node.view_all()


def activate(obj):
    ob = bpy.data.objects[obj]
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)


def props(ctx, search):
    """Properties tab ctx. The tabs that exist depend on the active object, so activate() and redraw first."""
    a = area("PROPERTIES")
    sp = a.spaces.active
    sp.context = ctx
    sp.search_filter = search
    return a


def target_mat(sub):
    return {"mats": "Skin", "sweater": "Sweater", "floor": "Floor"}.get(sub.on)


def gen():
    bpy.context.preferences.view.ui_scale = 1.25
    big = area("VIEW_3D")
    yield 0.5
    # widen the right-hand column (Outliner + Properties) so labels are not cut off
    a = area("PROPERTIES")
    x0, ym = a.x - 1, a.y + a.height // 2
    ev("MOUSEMOVE", "NOTHING", x0, ym)
    ev("LEFTMOUSE", "PRESS", x0, ym)
    ev("MOUSEMOVE", "NOTHING", x0 - 160, ym)
    ev("LEFTMOUSE", "RELEASE", x0 - 160, ym)
    yield 0.6
    steps = [int(s) for s in ONLY.split(",")] if ONLY else list(range(1, G.LAST + 1))
    for n in steps:
        G.build_to(n - 1) if n > 1 else G.base_scene()
        yield 0.3
        for sub, touched in G.iter_step(n):
            spec = sub.shot
            if spec == "auto":
                spec = ("nodes", target_mat(sub))
            if spec is None:
                continue
            kind = spec[0]
            if kind == "props":
                _, ctx, obj, search, how = spec
                if obj:
                    activate(obj)
                    yield 0.4
                # searching for a panel's title opens that panel
                a = props(ctx, "Custom Properties" if how == "CUSTOM" else search)
                yield 0.6
                if how == "CM":
                    click(a.x + 120, a.y + a.height - CM_HEADER_FROM_TOP)
                    yield 0.6
                shoot(a, sub.key)
                a.spaces.active.search_filter = ""
                continue
            if kind == "nodes":
                tree = bpy.data.materials[spec[1]].node_tree
                editor(big, "ShaderNodeTree", tree)
            elif kind == "group":
                tree = bpy.data.materials[spec[2]].node_tree
                gnode = next((nd for nd in tree.nodes if nd.bl_idname == "ShaderNodeGroup" and nd.node_tree.name == spec[1]), None)
                if gnode is None:  # the group exists but no material uses it yet: show it through a temporary node
                    gnode = tree.nodes.new("ShaderNodeGroup")
                    gnode.name = "_shot_tmp"
                    gnode.node_tree = bpy.data.node_groups[spec[1]]
                editor(big, "ShaderNodeTree", tree, gnode)
                tree, touched = gnode.node_tree, set()
            elif kind == "comp":
                tree = bpy.context.scene.compositing_node_group
                editor(big, "CompositorNodeTree", tree)
            elif kind == "cgroup":
                ct = bpy.context.scene.compositing_node_group
                gnode = ct.nodes[spec[1]]
                editor(big, "CompositorNodeTree", ct, gnode)
                tree, touched = gnode.node_tree, set()
            elif kind == "geo":
                ob = bpy.data.objects[spec[1]]
                bpy.context.view_layer.objects.active = ob
                ob.modifiers.active = ob.modifiers[0]
                tree = ob.modifiers[0].node_group
                editor(big, "GeometryNodeTree", tree)
                touched = set()
            select(tree, touched)
            yield 0.3
            frame(big, bool(touched) and kind in ("nodes", "comp"))
            yield 0.5
            shoot(big, sub.key)
            select(tree, set())
            big.spaces.active.pin = False
            for m in bpy.data.materials:
                if m.node_tree and "_shot_tmp" in m.node_tree.nodes:
                    big.spaces.active.path.pop()
                    m.node_tree.nodes.remove(m.node_tree.nodes["_shot_tmp"])
        if NO_VIEWPORT:
            continue
        # what Blender's viewport should look like at the end of the step
        big.ui_type = "VIEW_3D"
        sp = big.spaces.active
        sp.shading.type = "RENDERED"
        sp.shading.use_compositor = "ALWAYS" if bpy.context.scene.render.use_compositing else "DISABLED"
        sp.overlay.show_overlays = True
        sp.region_3d.view_perspective = "CAMERA"
        with bpy.context.temp_override(window=win(), area=big, region=main_region(big)):
            bpy.ops.view3d.view_center_camera()
        yield 14.0
        shoot(big, f"s{n}_viewport")
        sp.shading.type = "SOLID"
    bpy.ops.wm.quit_blender()


g = gen()


def tick():
    try:
        return next(g)
    except StopIteration:
        return None
    except Exception:
        import traceback
        traceback.print_exc()
        bpy.ops.wm.quit_blender()
        return None


bpy.app.timers.register(tick, first_interval=2.0)
