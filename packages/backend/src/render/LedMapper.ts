export interface LedMapper {
  mapLedIndex(ledIndex: number): number;
}

export class IdentityLedMapper implements LedMapper {
  mapLedIndex(ledIndex: number): number {
    return ledIndex;
  }
}

export class ReverseLedMapper implements LedMapper {
  constructor(
    private readonly totalLeds: number,
    private readonly target: LedMapper = new IdentityLedMapper()
  ) {}
  mapLedIndex(ledIndex: number): number {
    return this.totalLeds - 1 - this.target.mapLedIndex(ledIndex);
  }
}

export class SegmentedLedMapper implements LedMapper {
  constructor(private readonly childMappers: { startIndex: number; mapper: LedMapper }[]) {}
  mapLedIndex(ledIndex: number): number {
    for (let i = this.childMappers.length - 1; i >= 0; i--) {
      const { startIndex, mapper } = this.childMappers[i];
      if (ledIndex >= startIndex) {
        return mapper.mapLedIndex(ledIndex - startIndex) + startIndex;
      }
    }
    throw new Error(`LED index ${ledIndex} is out of bounds for SegmentedLedMapper`);
  }
}
