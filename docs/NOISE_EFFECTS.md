# Using Noise in Effects

This project now includes the `simplex-noise` library for creating organic, natural-looking animation effects.

## Quick Start

### 1. Import the NoiseGenerator utility

```typescript
import { NoiseGenerator } from "./util/NoiseUtils";
```

### 2. Create a noise generator in your effect class

```typescript
export class MyEffect implements Effect<LedPoint2D> {
    private noise = new NoiseGenerator();
    // ... rest of your effect
}
```

### 3. Use noise in your render function

```typescript
renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbValue[] {
    const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);
    
    for (const pt of points) {
        const noiseVal = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);
        const hue = this.noise.normalize(noiseVal); // Convert -1..1 to 0..1
        buffer[pt.id] = hslToRgb({ hue, saturation: 1.0, lightness: 0.5 });
    }
}
```

## Noise Types

### 2D Noise
Best for static spatial patterns:
```typescript
const value = this.noise.get2D(x, y);
```

### 3D Noise
Best for scrolling/animated patterns:
```typescript
const value = this.noise.get3D(x, y, ctx.phase * 2);
```

### 4D Noise
Best for seamless looping animations:
```typescript
const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);
const value = this.noise.get4D(x, y, nz, nw);
```

## Helper Methods

### normalize(noiseValue)
Converts noise output from [-1, 1] to [0, 1]:
```typescript
const hue = this.noise.normalize(noiseVal);
```

### map(noiseValue, min, max)
Maps noise output to any range:
```typescript
const brightness = this.noise.map(noiseVal, 0.2, 1.0);
```

### getLoopCoordinates(phase, radius)
Creates seamless loop coordinates for 4D noise:
```typescript
const [z, w] = this.noise.getLoopCoordinates(ctx.phase, 0.5);
```

## Scale Factors

Multiplying coordinates changes the "frequency" or "zoom" of the noise:
- **Lower values (0.5-1)**: Large, smooth blobs
- **Medium values (2-4)**: Medium-sized features
- **Higher values (8+)**: Fine, detailed patterns

```typescript
// Large features
const noise1 = this.noise.get4D(pt.x * 1, pt.y * 1, nz, nw);

// Medium features
const noise2 = this.noise.get4D(pt.x * 3, pt.y * 3, nz, nw);

// Fine details
const noise3 = this.noise.get4D(pt.x * 8, pt.y * 8, nz, nw);
```

## Example Effects

### Simple Color Noise (Slime)
```typescript
const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);
const noiseVal = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);
const hue = this.noise.normalize(noiseVal);
return hslToRgb({ hue, saturation: 0.8, lightness: 0.5 });
```

### Scrolling Clouds
```typescript
const noiseVal = this.noise.get3D(pt.x * 3, pt.y * 3, ctx.phase * 2);
const brightness = this.noise.map(noiseVal, 0.2, 1.0);
return hslToRgb({ hue: 0.55, saturation: 0.3, lightness: brightness * 0.5 });
```

### Multi-Layer Plasma
```typescript
const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);
const noise1 = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);
const noise2 = this.noise.get4D(pt.x * 4, pt.y * 4, nz * 0.5, nw * 0.5);
const noise3 = this.noise.get4D(pt.x * 8, pt.y * 8, nz * 0.25, nw * 0.25);
const combined = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
const hue = this.noise.normalize(combined);
return hslToRgb({ hue, saturation: 1.0, lightness: 0.5 });
```

## Available Effects

The following noise-based effects are now available:

- **slime**: Colorful organic blobs
- **clouds**: Blue/white cloud patterns
- **plasma**: Multi-layered rainbow plasma effect

Try them by calling the `/launch` endpoint with these effect names!
