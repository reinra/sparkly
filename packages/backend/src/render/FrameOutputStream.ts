import type { TwinklyApiClient } from "../deviceClient/apiClient";
import { logger } from "../logger";
import { hasWhiteChannel, LedType, type LedValue } from "../color/Color";
import type { LedMapper } from "./LedMapper";


export interface FrameFormat {
    led_type: LedType;
    led_count: number;
}
export interface FrameOutputStream {
    writeFrame(frame: LedValue[]): Promise<void>;
}

export interface FrameBuffer {
    base64_encoded: string | null; // Base64 encoded frame data
}

export class MultipleFrameOutputStream implements FrameOutputStream {
    constructor(private readonly outputs: FrameOutputStream[]) { }
    async writeFrame(frame: LedValue[]): Promise<void> {
        for (const output of this.outputs) {
            await output.writeFrame(frame);
        }   
    }
}

export class ApiClientFrameOutputStream implements FrameOutputStream {
    constructor(private readonly apiClient: TwinklyApiClient, private readonly frameFormat: FrameFormat) {
    }
    async writeFrame(frame: LedValue[]): Promise<void> {
        if (frame.length !== this.frameFormat.led_count) {
            throw new Error(`Effect frame length ${frame.length} does not match number of LEDs ${this.frameFormat.led_count}`);
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
    constructor(private readonly buffer: FrameBuffer) { }
    async writeFrame(frame: LedValue[]): Promise<void> {
        this.buffer.base64_encoded = this.encodeFrameToBase64(frame);
    }
    private encodeFrameToBase64(frame: LedValue[]): string {
        const bytes: number[] = [];
        for (const color of frame) {
            bytes.push(color.red, color.green, color.blue);
            // ignore white channel
        }
        const buffer = Buffer.from(bytes);
        return buffer.toString('base64');
    }
}

export class MovieBufferOutputStream implements FrameOutputStream {
    private buffers: Buffer[] = []; // Array of frames, each frame is a Buffer
    constructor(private readonly frameFormat: FrameFormat) { }
    async writeFrame(frame: LedValue[]): Promise<void> {
        if (frame.length !== this.frameFormat.led_count) {
            throw new Error(`Effect frame length ${frame.length} does not match number of LEDs ${this.frameFormat.led_count}`);
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
    ) { }
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

async function copyValues(color: LedValue, targetType: LedType, output: number[]) {
    if (targetType === LedType.RGB) {
        // Ignore white even if provided
        output.push(color.red, color.green, color.blue);
    } else if (hasWhiteChannel(color)) {
        output.push(color.white, color.red, color.green, color.blue);
    } else {
        output.push(0, color.red, color.green, color.blue);
    }
}
