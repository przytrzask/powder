"""Shared toolkit for the POWDER character scripts (art/skier*.py).

Characters are low poly and flat coloured: every face gets one palette colour (a vertex colour
attribute), so the game renders a whole skier with a single material.

Coordinates are the game's: metres before the in-game SCALE, y up, +z forward (downhill), feet
at the origin. The game animates the parts separately, so each one is its own object with its
origin at the joint it moves around. Every character uses the same parts and joints, so any
model can be dropped in for another:
  Boots  - boots; origin at the feet, stays flat on the skis
  Shins  - pants cuff + lower leg; origin at the ankle (tips forward to push the knees out)
  Thighs - upper leg, knee caps, seat; origin at the knee (folds back to drop the hips)
  Torso  - jacket, backpack, head; origin at the hip (leans forward to stay over the feet)
  Each hangs off the one before it: Boots > Shins > Thighs > Torso > Arms.
  Arm   - origin at the shoulder, hangs down -y          (ArmL / ArmR share the mesh)
  Ski   - centred, runs along z                          (SkiL / SkiR share the mesh)
  Pole  - centred, runs along y, grip at +y              (PoleL / PoleR share the mesh)
"""

import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', 'public', 'models')

# Joints, matching src/scene/Skier.tsx.
SHOULDER = (0.33, 1.28, 0)
ANKLE_Y = 0.2  # inside the boot shaft, hidden by the pants cuff
KNEE_Y = 0.47
HIP_Y = 0.8  # waist: top of the seat, origin of Torso
SKI_AT = (0.16, 0.04, 0.1)
POLE_IN_HAND = ((0, -0.945, -0.339), 0.6)  # position in the arm, x rotation
ARM_REST = 0.3

# game (y up, +z forward) -> Blender (z up, -y forward); the glTF exporter maps it back
GAME_TO_BLENDER = Matrix.Rotation(math.radians(90), 4, 'X')
UPRIGHT = Matrix.Rotation(math.radians(-90), 4, 'X')  # bmesh cones and spheres run along z


def rgba(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def to_blender(v):
    return GAME_TO_BLENDER @ Vector(v)


class Part:
    """A bmesh built from coloured primitives, in game coordinates."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Col')

    def paint(self, faces, color):
        c = rgba(color)
        for f in faces:
            for loop in f.loops:
                loop[self.col] = c

    def _finish(self, verts, color, matrix):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        self.paint({f for v in verts for f in v.link_faces}, color)

    @staticmethod
    def _matrix(center, rot):
        return Matrix.Translation(center) @ Euler(rot).to_matrix().to_4x4()

    def box(self, center, size, color, top=(1, 1), rot=(0, 0, 0)):
        """Axis-aligned box; `top` scales the upper face in x/z for a tapered block."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)['verts']
        for v in verts:
            if v.co.y > 0:
                v.co.x *= top[0]
                v.co.z *= top[1]
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        self._finish(verts, color, self._matrix(center, rot))

    def cyl(self, center, radius, height, color, segments=6, radius_top=None, scale=(1, 1, 1), rot=(0, 0, 0)):
        """Upright (y) cylinder or frustum."""
        verts = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=segments,
            radius1=radius, radius2=radius if radius_top is None else radius_top, depth=height,
        )['verts']
        s = Matrix.Diagonal((*scale, 1))
        self._finish(verts, color, self._matrix(center, rot) @ s @ UPRIGHT)

    def sphere(self, center, radius, color, segments=8, rings=6, scale=(1, 1, 1), cut=None):
        """Low-poly sphere; `cut=(point, normal)` removes everything behind that plane."""
        verts = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings, radius=radius)['verts']
        s = Matrix.Diagonal((*scale, 1))
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(center) @ s @ UPRIGHT, verts=verts)
        if cut:
            edges = list({e for v in verts for e in v.link_edges})
            faces = list({f for v in verts for f in v.link_faces})
            res = bmesh.ops.bisect_plane(self.bm, geom=verts + edges + faces, plane_co=cut[0], plane_no=cut[1], clear_inner=True)
            verts = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)] + [v for v in verts if v.is_valid]
            verts = list({v for v in verts if v.is_valid})
        self._finish(verts, color, Matrix.Identity(4))

    def mesh(self, name, shift=(0, 0, 0)):
        """`shift` re-origins the part after authoring it in absolute game coordinates, e.g. Torso
        is written in the same y values as the old single Body mesh but needs its origin at the
        hip, not the feet."""
        if shift != (0, 0, 0):
            bmesh.ops.translate(self.bm, vec=Vector(shift), verts=self.bm.verts)
        bmesh.ops.transform(self.bm, matrix=GAME_TO_BLENDER, verts=self.bm.verts)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        # the viewport, the preview render and the glTF exporter all read the active colour
        me.color_attributes.active_color_name = 'Col'
        me.color_attributes.render_color_index = 0
        return me


# Parts every character shares in shape; only the colours change.


def arm(sleeve, cuff, glove, glove_accent=None):
    p = Part()
    p.box((0, -0.01, 0), (0.18, 0.14, 0.18), sleeve)  # shoulder
    p.box((0, -0.24, 0), (0.14, 0.42, 0.14), sleeve, top=(1.1, 1.1))
    p.box((0, -0.44, 0), (0.155, 0.05, 0.155), cuff)
    p.box((0, -0.52, 0.01), (0.12, 0.12, 0.13), glove)
    if glove_accent:
        p.box((0, -0.5, 0.075), (0.1, 0.05, 0.02), glove_accent)
    return p.mesh('Arm')


def pole(shaft, grip, basket, tip):
    p = Part()
    p.cyl((0, -0.03, 0), 0.016, 1.14, shaft)
    p.cyl((0, 0.53, 0), 0.028, 0.14, grip, radius_top=0.025)
    p.cyl((0, -0.5, 0), 0.065, 0.012, basket)
    p.cyl((0, -0.58, 0), 0.004, 0.04, tip, radius_top=0.016)
    return p.mesh('Pole')


def ski(base, side, top_edge, top_center, binding, heel_accent=None):
    """Lofted along z: flat base, tail kicked up a little, tip bent up; top in three strips."""
    p = Part()
    bm = p.bm
    w, t, e = 0.13, 0.045, 0.03
    sections = [(-0.9, 0.03), (-0.82, 0), (0.6, 0), (0.72, 0.02), (0.82, 0.06), (0.9, 0.1)]
    xs = [-w / 2, -w / 2 + e, w / 2 - e, w / 2]
    rings = []
    for z, lift in sections:
        lo, hi = lift - t / 2, lift + t / 2
        # bottom-left, bottom-right, then the top from right to left
        pts = [(xs[0], lo), (xs[3], lo), (xs[3], hi), (xs[2], hi), (xs[1], hi), (xs[0], hi)]
        rings.append([bm.verts.new((x, y, z)) for x, y in pts])
    # colour of each side of the cross-section: base, right, top strips, left
    side_colors = [base, side, top_edge, top_center, top_edge, side]
    for a, b in zip(rings, rings[1:]):
        for i, color in enumerate(side_colors):
            j = (i + 1) % 6
            p.paint([bm.faces.new((a[i], a[j], b[j], b[i]))], color)
    p.paint([bm.faces.new(list(reversed(rings[0]))), bm.faces.new(rings[-1])], side)
    # bindings in front of and behind the boot
    p.box((0, 0.045, 0.11), (0.09, 0.05, 0.07), binding)
    p.box((0, 0.05, -0.26), (0.09, 0.06, 0.08), binding)
    if heel_accent:
        p.box((0, 0.083, -0.26), (0.092, 0.012, 0.082), heel_accent)
    return p.mesh('Ski')


def _add(name, mesh, material, location=(0, 0, 0), rot_x=0.0, parent=None):
    if not mesh.materials:
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = to_blender(location)
    obj.rotation_euler = (rot_x, 0, 0)  # game x == Blender x
    return obj


def _material():
    mat = bpy.data.materials.new('Skier')
    if mat.node_tree is None:  # Blender < 5 creates materials without nodes
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    return mat


def _render_previews(name):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.color_type = 'VERTEX'
    shading.show_shadows = True
    shading.show_cavity = True
    scene.display.shadow_focus = 0.4
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    world = bpy.data.worlds.new('Sky')
    world.color = (0.85, 0.9, 0.97)
    scene.world = world

    cam = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
    scene.collection.objects.link(cam)
    cam.data.lens = 70
    scene.camera = cam
    target = Vector((0, 0, 0.9))
    # front = game +z = Blender -y
    for label, pos in (('front', (1.5, -3.6, 1.6)), ('back', (-1.5, 3.6, 1.9))):
        cam.location = pos
        cam.rotation_euler = (target - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(HERE, f'preview-{name}-{label}.png')
        bpy.ops.render.render(write_still=True)


def knee(p, x, color):
    """Round knee cap centred on the knee joint, so the thigh can fold without opening a gap."""
    p.sphere((x, KNEE_Y, 0.005), 0.112, color, segments=6, rings=4, scale=(0.9, 1, 1.05))


def build_character(name, boots, shins, thighs, torso, arm, pole, ski):
    """Each argument after `name` is a function returning that part's mesh.

    Writes public/models/<name>.glb, art/<name>.blend and art/preview-<name>-{front,back}.png.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = _material()

    boots_obj = _add('Boots', boots(), mat)
    shins_obj = _add('Shins', shins(), mat, (0, ANKLE_Y, 0), parent=boots_obj)
    thighs_obj = _add('Thighs', thighs(), mat, (0, KNEE_Y - ANKLE_Y, 0), parent=shins_obj)
    torso_obj = _add('Torso', torso(), mat, (0, HIP_Y - KNEE_Y, 0), parent=thighs_obj)
    arm_mesh, pole_mesh, ski_mesh = arm(), pole(), ski()
    # laid out in the game's rest pose: arms swung back a little, pole grip in the glove
    for side, s in ((-1, 'L'), (1, 'R')):
        arm_obj = _add(
            f'Arm{s}', arm_mesh, mat, (SHOULDER[0] * side, SHOULDER[1] - HIP_Y, SHOULDER[2]), rot_x=ARM_REST, parent=torso_obj
        )
        _add(f'Pole{s}', pole_mesh, mat, POLE_IN_HAND[0], rot_x=POLE_IN_HAND[1], parent=arm_obj)
        _add(f'Ski{s}', ski_mesh, mat, (SKI_AT[0] * side, *SKI_AT[1:]))

    for me in (boots_obj.data, shins_obj.data, thighs_obj.data, torso_obj.data, arm_mesh, pole_mesh, ski_mesh):
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        print(f'[{name}] {me.name}: {tris} tris')

    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(MODELS, f'{name}.glb'), export_format='GLB', export_yup=True, export_apply=True,
        export_vertex_color='ACTIVE', export_animations=False, export_cameras=False, export_lights=False,
    )
    _render_previews(name)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups next to the scripts
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'{name}.blend'))
