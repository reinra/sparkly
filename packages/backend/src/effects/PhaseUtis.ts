

export function revertPhase(phase: number): number {
    return 1 - phase; // Revert the phase to go backwards
}

export function backAndForthPhase(phase: number): number {
    return phase <= 0.5 ? phase * 2 : (1 - phase) * 2; // Back and forth between 0 and 1
}

export function backAndForthPhaseWithPause(phase: number): number {
   if (phase < 0.25) {
     return phase * 4; // 0 to 1
   } else if (phase < 0.5) {
     return 1; // Pause at 1
   } else if (phase < 0.75) {
     return 1 - (phase - 0.5) * 4; // 1 to 0
   } else {
     return 0; // Pause at 0
   }
}
