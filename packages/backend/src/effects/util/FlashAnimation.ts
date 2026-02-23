import { type RgbFloat, BLACK } from '../../color/ColorFloat';

/**
 * Reusable flashing animation that alternates between a saved buffer and black.
 * Used after a cycle completes to produce a visual "flash" before clearing.
 */
export class FlashAnimation {
  private step: number = 0;
  private accumulatedMs: number = 0;
  private readonly savedBuffer: RgbFloat[];
  private _finished: boolean = false;

  /** Number of flash steps (on/off pairs). 10 steps = 5 flashes. */
  private readonly totalSteps: number;

  constructor(savedBuffer: RgbFloat[], totalSteps: number = 10) {
    this.savedBuffer = savedBuffer;
    this.totalSteps = totalSteps;
  }

  get finished(): boolean {
    return this._finished;
  }

  /** Advances the flash animation by deltaMs and returns the frame to display. */
  advance(total: number, deltaMs: number, millisPerStep: number): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(total).fill(BLACK);
    this.accumulatedMs += deltaMs;
    if (this.accumulatedMs >= millisPerStep) {
      this.accumulatedMs -= millisPerStep;
      this.step++;
    }
    if (this.step >= this.totalSteps) {
      this._finished = true;
      return buffer;
    }
    if (this.step % 2 === 1) {
      for (let i = 0; i < this.savedBuffer.length; i++) {
        buffer[i] = this.savedBuffer[i];
      }
    }
    return buffer;
  }
}
