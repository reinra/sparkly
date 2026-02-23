import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────

export type MovieTaskStatus = 'rendering' | 'uploading' | 'configuring' | 'completed' | 'error';

export interface MovieTaskProgress {
  status: MovieTaskStatus;
  /** Rendering progress 0–1. For Loop effects this equals the animation phase. */
  progress: number;
  /** Number of frames rendered so far. */
  framesRendered: number;
  /** Estimated total frames (known for Loop/Sequence, 1 for Static, null if unknown). */
  totalFrames: number | null;
  /** Final frame count once rendering is complete. */
  frameCount: number | null;
  /** Error message if status is 'error'. */
  error: string | null;
  /** Name of the effect being sent. */
  effectName: string;
  /** Device ID this task belongs to. */
  deviceId: string;
}

// ── In-memory store (one task per device) ─────────────────────────────

const movieTasks = new Map<string, MovieTaskProgress>();

export function startMovieTask(deviceId: string, effectName: string): MovieTaskProgress {
  const task: MovieTaskProgress = {
    status: 'rendering',
    progress: 0,
    framesRendered: 0,
    totalFrames: null,
    frameCount: null,
    error: null,
    effectName,
    deviceId,
  };
  movieTasks.set(deviceId, task);
  logger.withMetadata({ deviceId, effectName }).info('Movie task started');
  return task;
}

export function getMovieTaskProgress(deviceId: string): MovieTaskProgress | null {
  return movieTasks.get(deviceId) ?? null;
}

export function updateMovieTask(deviceId: string, update: Partial<MovieTaskProgress>): void {
  const task = movieTasks.get(deviceId);
  if (task) {
    Object.assign(task, update);
  }
}

export function completeMovieTask(deviceId: string, frameCount: number): void {
  updateMovieTask(deviceId, {
    status: 'completed',
    progress: 1,
    frameCount,
    framesRendered: frameCount,
  });
  logger.withMetadata({ deviceId, frameCount }).info('Movie task completed');
}

export function failMovieTask(deviceId: string, error: string): void {
  updateMovieTask(deviceId, {
    status: 'error',
    error,
  });
  logger.withMetadata({ deviceId, error }).error('Movie task failed');
}

/** Returns true if the given device has an in-progress movie task. */
export function isMovieTaskActive(deviceId: string): boolean {
  const task = movieTasks.get(deviceId);
  if (!task) return false;
  return task.status === 'rendering' || task.status === 'uploading' || task.status === 'configuring';
}
