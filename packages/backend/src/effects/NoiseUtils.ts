import { createNoise2D, createNoise3D, createNoise4D } from "simplex-noise";

/**
 * Utility class for creating and managing noise generators.
 * Simplex noise is a gradient noise function that produces smooth, natural-looking patterns.
 * 
 * Noise values range from -1 to 1.
 * 
 * Usage examples:
 * - 2D noise: Use for spatial effects based on X,Y coordinates
 * - 3D noise: Use for spatial + time effects (X,Y,time)
 * - 4D noise: Use for seamless looping animations (X,Y,sin(phase),cos(phase))
 */
export class NoiseGenerator {
    readonly noise2D = createNoise2D();
    readonly noise3D = createNoise3D();
    readonly noise4D = createNoise4D();

    /**
     * Get a 2D noise value
     * @param x X coordinate
     * @param y Y coordinate
     * @returns Noise value between -1 and 1
     */
    get2D(x: number, y: number): number {
        return this.noise2D(x, y);
    }

    /**
     * Get a 3D noise value
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @returns Noise value between -1 and 1
     */
    get3D(x: number, y: number, z: number): number {
        return this.noise3D(x, y, z);
    }

    /**
     * Get a 4D noise value - ideal for seamless looping animations
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @param w W coordinate
     * @returns Noise value between -1 and 1
     */
    get4D(x: number, y: number, z: number, w: number): number {
        return this.noise4D(x, y, z, w);
    }

    /**
     * Helper to create seamless loop coordinates in 3D/4D noise space
     * @param phase Value from 0 to 1 representing animation progress
     * @param radius Radius of the circle in noise space (default: 0.5)
     * @returns [z, w] coordinates that loop seamlessly
     */
    getLoopCoordinates(phase: number, radius: number = 0.5): [number, number] {
        const angle = phase * Math.PI * 2;
        return [
            Math.sin(angle) * radius,
            Math.cos(angle) * radius
        ];
    }

    /**
     * Map noise value (-1 to 1) to range (0 to 1)
     */
    normalize(noiseValue: number): number {
        return (noiseValue + 1) / 2;
    }

    /**
     * Map noise value (-1 to 1) to arbitrary range
     */
    map(noiseValue: number, min: number, max: number): number {
        const normalized = this.normalize(noiseValue);
        return min + normalized * (max - min);
    }
}
