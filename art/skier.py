"""The default skier: charcoal hooded jacket, tan cargo pants, tan helmet, blue mirrored goggles,
beard, orange backpack and poles. Writes public/models/skier.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P art/skier.py

Shared building blocks, joints and export live in art/lowpoly.py.
"""

import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly  # noqa: E402
from lowpoly import ANKLE_Y, HIP_Y, KNEE_Y, Part  # noqa: E402

# Palette picked from the reference photo.
JACKET = '#262a31'
JACKET_DARK = '#16181c'
HOOD = '#30353d'
PANTS = '#c98a42'
PANTS_DARK = '#a96f30'
BOOT = '#5d6a4c'
BOOT_DARK = '#3a4230'
SOLE = '#1c1d1f'
PACK = '#e5582a'
PACK_DARK = '#bf4520'
PACK_STRAP = '#6f757d'
SKIN = '#e3ad8b'
BEARD = '#6e4b32'
HELMET = '#caa060'
GOGGLE_FRAME = '#15171b'
LENS = '#2c79e8'
LENS_LIGHT = '#8fd6ff'
GOGGLE_STRAP = '#1e2748'
GLOVE = '#17181b'
GLOVE_ACCENT = '#b99a6b'
POLE = '#ee5a1c'
GRIP = '#1a1b1e'
SKI_TOP = '#f1f1ec'
SKI_EDGE = '#24262b'
BINDING = '#2e3137'


def build_boots():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        p.box((x, 0.085, 0.03), (0.17, 0.04, 0.32), SOLE)
        p.box((x, 0.22, 0.02), (0.16, 0.24, 0.28), BOOT, top=(1, 0.8))
        p.box((x, 0.25, 0.02), (0.17, 0.035, 0.27), BOOT_DARK)
    return p.mesh('Boots')


def build_shins():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        # baggy cargo pants: cuff over the boot, lower leg up to the knee
        p.box((x, 0.37, 0.01), (0.21, 0.14, 0.27), PANTS)
        p.box((x, 0.43, 0.0), (0.2, 0.12, 0.24), PANTS)
    return p.mesh('Shins', shift=(0, -ANKLE_Y, 0))


def build_thighs():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        lowpoly.knee(p, x, PANTS)
        p.box((x, 0.645, 0.0), (0.205, 0.35, 0.245), PANTS, top=(1.05, 1.05))
        p.box((x + 0.105 * s, 0.62, 0.02), (0.04, 0.15, 0.14), PANTS_DARK)  # cargo pocket
    p.box((0, 0.8, 0), (0.46, 0.14, 0.26), PANTS)
    return p.mesh('Thighs', shift=(0, -KNEE_Y, 0))


def build_torso():
    p = Part()
    # long hooded jacket, shoulders a bit wider than the hem
    p.box((0, 1.05, 0), (0.5, 0.66, 0.3), JACKET, top=(1.08, 1.0))
    p.box((0, 0.745, 0), (0.51, 0.05, 0.31), JACKET_DARK)
    p.box((0, 1.06, 0.152), (0.025, 0.58, 0.01), JACKET_DARK)  # zip
    for s in (-1, 1):
        p.box((0.13 * s, 0.95, 0.152), (0.12, 0.02, 0.01), JACKET_DARK)  # pocket flaps
    p.box((0, 1.42, 0.01), (0.3, 0.12, 0.26), JACKET, top=(0.9, 0.9))  # collar
    p.box((0, 1.41, -0.12), (0.34, 0.12, 0.12), HOOD)

    # backpack: orange shoulder straps in front, pack on the back (reads well from above)
    for s in (-1, 1):
        x = 0.12 * s
        p.box((x, 1.2, 0.155), (0.07, 0.34, 0.015), PACK)
        p.box((x, 1.385, 0), (0.07, 0.015, 0.31), PACK)
        p.box((x, 0.98, 0.155), (0.06, 0.12, 0.012), PACK_STRAP)
        p.box((0.1 * s, 1.08, -0.283), (0.035, 0.4, 0.008), PACK_STRAP)
    p.box((0, 1.22, 0.163), (0.26, 0.025, 0.01), PACK_STRAP)  # sternum strap
    p.box((0, 1.1, -0.215), (0.38, 0.46, 0.13), PACK, top=(0.92, 0.85))
    p.box((0, 1.33, -0.215), (0.37, 0.05, 0.14), PACK_DARK)

    # head: face + beard, helmet cut higher at the front, goggles on the helmet edge
    p.sphere((0, 1.58, 0), 0.16, SKIN, segments=8, rings=6, scale=(1, 1.12, 1))
    p.box((0, 1.49, 0.07), (0.22, 0.1, 0.16), BEARD, top=(1.05, 1.1))
    p.box((0, 1.56, 0.165), (0.04, 0.05, 0.04), SKIN)  # nose
    p.sphere((0, 1.62, -0.01), 0.2, HELMET, segments=10, rings=7, scale=(1, 0.95, 1.05), cut=((0, 1.58, 0), (0, 1, -0.35)))
    p.cyl((0, 1.625, -0.03), 0.208, 0.055, GOGGLE_STRAP, segments=10, scale=(1, 1, 1.05))
    p.box((0, 1.625, 0.165), (0.32, 0.1, 0.08), GOGGLE_FRAME)
    p.box((0, 1.625, 0.207), (0.28, 0.078, 0.012), LENS)
    p.box((0, 1.65, 0.214), (0.26, 0.02, 0.004), LENS_LIGHT)
    return p.mesh('Torso', shift=(0, -HIP_Y, 0))


lowpoly.build_character(
    'skier',
    boots=build_boots,
    shins=build_shins,
    thighs=build_thighs,
    torso=build_torso,
    arm=lambda: lowpoly.arm(JACKET, JACKET_DARK, GLOVE, GLOVE_ACCENT),
    pole=lambda: lowpoly.pole(POLE, GRIP, GRIP, SKI_EDGE),
    ski=lambda: lowpoly.ski(SKI_EDGE, SKI_EDGE, SKI_EDGE, SKI_TOP, BINDING),
)
