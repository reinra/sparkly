import type { TwinklyApiClient } from '../deviceClient/ApiClient';
import { logger } from '../logger';
import { hasWhiteChannel, LedType, type LedValue } from '../color/Color8bit';
import type { LedMapper } from './LedMapper';

export interface FrameFormat {
  led_type: LedType;
  led_count: number;
}
export interface FrameOutputStream {
  writeFrame(frame: LedValue[]): Promise<void>;
  setPhase?(phase: number | null): void;
}

export interface FrameBuffer {
  base64_encoded: string | null; // Base64 encoded frame data
  phase: number | null; // Current phase [0, 1) for loop effects, null otherwise
}

export class MultipleFrameOutputStream implements FrameOutputStream {
  constructor(private readonly outputs: FrameOutputStream[]) {}
  async writeFrame(frame: LedValue[]): Promise<void> {
    for (const output of this.outputs) {
      await output.writeFrame(frame);
    }
  }
  setPhase(phase: number | null): void {
    for (const output of this.outputs) {
      output.setPhase?.(phase);
    }
  }
}

export class ApiClientFrameOutputStream implements FrameOutputStream {
  constructor(
    private readonly apiClient: TwinklyApiClient,
    private readonly frameFormat: FrameFormat
  ) {}
  async writeFrame(frame: LedValue[]): Promise<void> {
    if (frame.length !== this.frameFormat.led_count) {
      throw new Error(
        `Effect frame length ${frame.length} does not match number of LEDs ${this.frameFormat.led_count}`
      );
    }
    const ledValues: number[] = [];
    for (const color of frame) {
      await copyValues(color, this.frameFormat.led_type, ledValues);
    }
    logger.withMetadata({ device: this.apiClient.getIp() }).trace(`Sending LED values`);
    await this.apiClient.sendLedValues(ledValues);
  }
}

export class BufferReplacingFrameOutputStream implements FrameOutputStream {
  constructor(private readonly buffer: FrameBuffer) {}
  async writeFrame(frame: LedValue[]): Promise<void> {
    this.buffer.base64_encoded = this.encodeFrameToBase64(frame);
  }
  setPhase(phase: number | null): void {
    this.buffer.phase = phase;
  }
  private encodeFrameToBase64(frame: LedValue[]): string {
    const bytes: number[] = [];
    for (const color of frame) {
      bytes.push(color.red8, color.green8, color.blue8);
      // ignore white channel
    }
    const buffer = Buffer.from(bytes);
    return buffer.toString('base64');
  }
}

export class MovieBufferOutputStream implements FrameOutputStream {
  private buffers: Buffer[] = []; // Array of frames, each frame is a Buffer
  constructor(private readonly frameFormat: FrameFormat) {}
  async writeFrame(frame: LedValue[]): Promise<void> {
    if (frame.length !== this.frameFormat.led_count) {
      throw new Error(
        `Effect frame length ${frame.length} does not match number of LEDs ${this.frameFormat.led_count}`
      );
    }
    const bytes: number[] = [];
    for (const color of frame) {
      await copyValues(color, this.frameFormat.led_type, bytes);
    }
    this.buffers.push(Buffer.from(bytes));
  }
  public getMovieBuffer(): Buffer {
    return Buffer.concat(this.buffers);
  }
  public getFrameCount(): number {
    return this.buffers.length;
  }
}

export class MappedFrameOutputStream implements FrameOutputStream {
  constructor(
    private readonly target: FrameOutputStream,
    private readonly mapper: LedMapper
  ) {}
  setPhase(phase: number | null): void {
    this.target.setPhase?.(phase);
  }
  async writeFrame(frame: LedValue[]): Promise<void> {
    const result: LedValue[] = new Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const mappedIndex = this.mapper.mapLedIndex(i);
      if (mappedIndex < 0 || mappedIndex >= frame.length) {
        throw new Error(`Mapped LED index ${mappedIndex} is out of bounds for frame length ${frame.length}`);
      }
      result[mappedIndex] = frame[i];
    }
    await this.target.writeFrame(result);
  }
}

/**
 * Wraps another FrameOutputStream, calling a callback after each frame is written.
 * Used to track rendering progress for the movie-send pipeline.
 */
export class ProgressTrackingFrameOutputStream implements FrameOutputStream {
  private frameCount = 0;
  constructor(
    private readonly target: FrameOutputStream,
    private readonly onFrame: (frameIndex: number) => void
  ) {}
  async writeFrame(frame: LedValue[]): Promise<void> {
    await this.target.writeFrame(frame);
    this.frameCount++;
    this.onFrame(this.frameCount);
  }
  setPhase(phase: number | null): void {
    this.target.setPhase?.(phase);
  }
  public getFrameCount(): number {
    return this.frameCount;
  }
}

async function copyValues(color: LedValue, targetType: LedType, output: number[]) {
  if (targetType === LedType.RGB) {
    // Ignore white even if provided
    output.push(color.red8, color.green8, color.blue8);
  } else if (hasWhiteChannel(color)) {
    output.push(color.white8, color.red8, color.green8, color.blue8);
  } else {
    output.push(0, color.red8, color.green8, color.blue8);
  }
}
