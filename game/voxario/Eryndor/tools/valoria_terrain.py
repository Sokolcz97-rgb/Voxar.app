"""Reconstructed island footprint for Aethelgard's terrain generator."""
import numpy as np

CENTER_X = 3000.0
CENTER_Z = 2400.0


def _smoothstep(a, b, value):
    t = np.clip((value - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def apply(height, x, z):
    dx, dz = x - CENTER_X, z - CENTER_Z
    radius = np.sqrt((dx / 600.0) ** 2 + (dz / 700.0) ** 2)
    coast_variation = (0.5 + 0.25 * np.sin(dx / 83.0 + dz / 139.0)
                       + 0.25 * np.sin(dz / 71.0 - dx / 169.0))
    coast_radius = radius + 0.20 * coast_variation * _smoothstep(0.55, 0.85, radius)
    mask = 1.0 - _smoothstep(0.65, 1.0, coast_radius)
    keep_radius = np.sqrt((dx / 190.0) ** 2 + ((dz + 235.0) / 150.0) ** 2)
    keep_hill = 20.0 * (1.0 - _smoothstep(0.15, 1.0, keep_radius))
    rolling = (np.sin(dx / 93.0 + dz / 155.0) + 0.5 * np.sin(dz / 57.0 - dx / 116.0))
    relief = (8.0 + 4.5 * rolling) * _smoothstep(0.30, 0.62, radius)
    city = (1.0 - _smoothstep(75.0, 130.0, np.abs(dx))) * (1.0 - _smoothstep(315.0, 370.0, np.abs(dz)))
    island = 12.0 + keep_hill + relief * (1.0 - city)
    return height * (1.0 - mask) + island * mask, mask


def surface_weights(height, slope, noise):
    """Grass, soil, sand, rock weights; rows sum to one."""
    sand = (1.0 - _smoothstep(1.0, 6.0, height)) * (1.0 - _smoothstep(0.35, 0.8, slope))
    rock = _smoothstep(0.24, 0.70, slope) * (1.0 - sand)
    soil = (1.0 - sand - rock) * (0.12 + 0.23 * np.clip(noise, 0.0, 1.0))
    grass = 1.0 - sand - rock - soil
    return grass, soil, sand, rock
