"""Reconstructed island footprint for Aethelgard's terrain generator."""
import numpy as np

CENTER_X = 3000.0
CENTER_Z = 2400.0


def _smoothstep(a, b, value):
    t = np.clip((value - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def apply(height, x, z):
    radius = np.sqrt(((x - CENTER_X) / 600.0) ** 2 + ((z - CENTER_Z) / 700.0) ** 2)
    mask = 1.0 - _smoothstep(0.65, 1.0, radius)
    keep_radius = np.sqrt(((x - CENTER_X) / 190.0) ** 2 + ((z - (CENTER_Z - 235.0)) / 150.0) ** 2)
    keep_hill = 20.0 * (1.0 - _smoothstep(0.15, 1.0, keep_radius))
    island = 12.0 + keep_hill
    return height * (1.0 - mask) + island * mask, mask
