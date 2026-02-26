import { logger, logError } from './logger';

export interface Task {
  run: (abort: AbortSignal) => Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && error.message?.includes('The operation was aborted'))
  );
}

export class TaskExecutor {
  private abortControllers: { [key: string]: AbortController } = {};

  startAndAbortPreviousTask(key: string, task: Task) {
    try {
      this.abortTask(key);
    } catch (error) {
      // Ignore AbortError when aborting previous task
      if (!isAbortError(error)) {
        logError(error).error(`Error aborting previous task with key '${key}'`);
      }
    }

    const abortController = new AbortController();
    this.abortControllers[key] = abortController;
    setImmediate(async () => {
      logger.info(`Starting task with key '${key}'`);
      try {
        await task.run(abortController.signal);
      } catch (error) {
        if (isAbortError(error)) {
          logger.info(`Task with key '${key}' was aborted`);
        } else {
          logError(error).error(`Error in task with key '${key}'`);
        }
      }
    });
  }

  abortTask(key: string) {
    if (this.abortControllers[key]) {
      logger.info(`Aborting running task with key '${key}'`);
      try {
        this.abortControllers[key].abort();
      } catch (error) {
        // Ignore AbortError - it's expected when aborting
        if (!isAbortError(error)) {
          throw error;
        }
      }
      delete this.abortControllers[key];
    } else {
      logger.info(`No running task with key '${key}' to abort`);
    }
  }
}
