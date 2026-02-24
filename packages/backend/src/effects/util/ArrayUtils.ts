import { type RgbFloat, BLACK } from '../../color/ColorFloat';

/**
 * Create a buffer of the given length filled with BLACK.
 */
export function createBlackBuffer(length: number): RgbFloat[] {
  return new Array(length).fill(BLACK);
}

/**
 * Fisher-Yates (Knuth) in-place shuffle of a single array.
 */
export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Fisher-Yates in-place shuffle applied to multiple parallel arrays
 * (all arrays are shuffled with the same permutation).
 *
 * All arrays must have the same length.
 */
export function shuffleParallel(...arrays: unknown[][]): void {
  if (arrays.length === 0) return;
  const length = arrays[0].length;
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    for (const arr of arrays) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

/**
 * Create a sequential index array [0, 1, 2, …, length-1] and shuffle it in place.
 * Returns the shuffled array.
 */
export function createShuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  shuffleArray(indices);
  return indices;
}

/**
 * Pick a random index in [0, total) that is not in the occupied set.
 * Uses rejection sampling for low occupancy and linear scan for high occupancy.
 */
export function pickRandomFreeIndex(total: number, occupied: { has(index: number): boolean; size: number }): number {
  const remaining = total - occupied.size;
  if (remaining <= 0) return -1;

  // Low occupancy — rejection sampling is fast
  if (occupied.size < total * 0.7) {
    let index: number;
    do {
      index = Math.floor(Math.random() * total);
    } while (occupied.has(index));
    return index;
  }

  // High occupancy — pick the nth free slot
  const nth = Math.floor(Math.random() * remaining);
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (!occupied.has(i)) {
      if (count === nth) return i;
      count++;
    }
  }
  return -1; // unreachable
}
