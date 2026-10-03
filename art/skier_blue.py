"""Second skier: steel-blue hooded jacket, black pants, black matte helmet, white goggles with an
amber lens, grey camo neck gaiter over the face, black boots with red accents, black skis.
Writes public/models/skier-blue.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P art/skier_blue.py

Shared building blocks, joints and export live in art/lowpoly.py.
"""

import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly  # noqa: E402
from lowpoly import ANKLE_Y, HIP_Y, KNEE_Y, Part  # noqa: E402

# Palette picked from the reference photo.
JACKET = '#5a84ac'
JACKET_DARK = '#3f6488'
BLACK = '#17181b'
PANTS = '#25272c'
BOOT = '#141518'
BOOT_RED = '#d4302a'
BUCKLE = '#b9bdc3'
SOLE = '#1c1d1f'
GAITER = '#707378'
GAITER_DARK = '#4b4e53'
GAITER_LIGHT = '#9a9da2'
HELMET = '#232428'
GOGGLE_FRAME = '#eeeeee'
LENS = '#e0782c'
LENS_LIGHT = '#f2b066'
GOGGLE_STRAP = '#111214'
GLOVE = '#141518'
POLE = '#3b3e44'
GRIP = '#d7d9dc'
BASKET = '#141518'
TIP = '#b9bdc3'
SKI_BASE = '#1a1b1e'
SKI_SIDE = '#e8e8ea'
SKI_TOP = '#2e3036'
BINDING = '#1f2024'


def build_boots():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        # black boots: red stripe above the sole, red cuff at the back, silver buckles outside
        p.box((x, 0.085, 0.03), (0.17, 0.04, 0.32), SOLE)
        p.box((x, 0.22, 0.02), (0.16, 0.24, 0.28), BOOT, top=(1, 0.8))
        p.box((x, 0.108, 0.03), (0.172, 0.014, 0.322), BOOT_RED)
        p.box((x, 0.2, -0.09), (0.165, 0.1, 0.05), BOOT_RED)
        for y, z in ((0.19, 0.07), (0.27, 0.02)):
            p.box((x + 0.082 * s, y, z), (0.012, 0.03, 0.08), BUCKLE)
    return p.mesh('Boots')


def build_shins():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        # straight, slightly baggy black pants: cuff over the boot, lower leg up to the knee
        p.box((x, 0.37, 0.01), (0.21, 0.14, 0.27), PANTS)
        p.box((x, 0.43, 0.0), (0.2, 0.12, 0.24), PANTS)
    return p.mesh('Shins', shift=(0, -ANKLE_Y, 0))


def build_thighs():
    p = Part()
    for s in (-1, 1):
        x = 0.16 * s
        lowpoly.knee(p, x, PANTS)
        p.box((x, 0.645, 0.0), (0.205, 0.35, 0.245), PANTS, top=(1.05, 1.05))
    p.box((0, 0.8, 0), (0.46, 0.14, 0.26), PANTS)
    return p.mesh('Thighs', shift=(0, -KNEE_Y, 0))


def build_torso():
    p = Part()
    # steel-blue jacket down to the hips, black strip across the chest, zipped side pockets
    p.box((0, 1.05, 0), (0.5, 0.66, 0.3), JACKET, top=(1.08, 1.0))
    p.box((0, 0.745, 0), (0.51, 0.05, 0.31), JACKET_DARK)
    p.box((0, 1.06, 0.152), (0.025, 0.58, 0.01), JACKET_DARK)  # zip
    p.box((-0.01, 1.29, 0.153), (0.38, 0.03, 0.012), BLACK)
    for s in (-1, 1):
        p.box((0.2 * s, 0.9, 0.152), (0.015, 0.16, 0.01), JACKET_DARK)
    p.box((0, 1.28, -0.152), (0.5, 0.02, 0.01), JACKET_DARK)  # back yoke seam
    p.box((0, 1.42, 0.01), (0.3, 0.12, 0.26), JACKET, top=(0.9, 0.9))  # collar
    p.box((0, 1.42, -0.12), (0.36, 0.15, 0.13), BLACK)  # hood

    # head wrapped in a camo gaiter up to the goggles, full black helmet over the ears
    p.sphere((0, 1.58, 0), 0.16, GAITER, segments=8, rings=6, scale=(1, 1.12, 1))
    p.box((0, 1.46, 0.02), (0.24, 0.1, 0.22), GAITER)  # neck tube
    p.box((0, 1.56, 0.165), (0.04, 0.05, 0.04), GAITER)  # nose
    for (x, y, z), size, color in (
        ((-0.05, 1.53, 0.155), (0.05, 0.04, 0.02), GAITER_DARK),
        ((0.05, 1.5, 0.15), (0.06, 0.035, 0.02), GAITER_LIGHT),
        ((0.03, 1.555, 0.16), (0.04, 0.03, 0.02), GAITER_DARK),
        ((-0.07, 1.47, 0.132), (0.05, 0.03, 0.02), GAITER_LIGHT),
        ((0.08, 1.46, 0.132), (0.04, 0.03, 0.02), GAITER_DARK),
    ):
        p.box((x, y, z), size, color)  # camo patches
    p.sphere((0, 1.62, -0.01), 0.205, HELMET, segments=10, rings=7, scale=(1, 0.97, 1.08), cut=((0, 1.54, 0), (0, 1, -0.45)))
    p.cyl((0, 1.625, -0.03), 0.215, 0.055, GOGGLE_STRAP, segments=10, scale=(1, 1, 1.08))
    p.box((0, 1.625, 0.168), (0.33, 0.105, 0.08), GOGGLE_FRAME)
    p.box((0, 1.625, 0.21), (0.28, 0.078, 0.012), LENS)
    p.box((0, 1.645, 0.217), (0.26, 0.018, 0.004), LENS_LIGHT)
    return p.mesh('Torso', shift=(0, -HIP_Y, 0))


lowpoly.build_character(
    'skier-blue',
    boots=build_boots,
    shins=build_shins,
    thighs=build_thighs,
    torso=build_torso,
    arm=lambda: lowpoly.arm(JACKET, JACKET_DARK, GLOVE),
    pole=lambda: lowpoly.pole(POLE, GRIP, BASKET, TIP),
    ski=lambda: lowpoly.ski(SKI_BASE, SKI_SIDE, SKI_BASE, SKI_TOP, BINDING, heel_accent=BOOT_RED),
)
