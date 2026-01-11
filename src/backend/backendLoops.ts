export interface Task {
  run: (abort: AbortSignal) => Promise<void>;
}

const abortControllers: { [key: string]: AbortController } = {};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && error.message?.includes('The operation was aborted'))
  );
}

export function startAndAbortPreviousTask(key: string, task: Task) {
  try {
    abortTask(key);
  } catch (error) {
    // Ignore AbortError when aborting previous task
    if (!isAbortError(error)) {
      console.error(`Error aborting previous task with key '${key}':`, error);
    }
  }

  const abortController = new AbortController();
  abortControllers[key] = abortController;
  setImmediate(async () => {
    console.log(`Starting task with key '${key}'...`);
    try {
      await task.run(abortController.signal);
    } catch (error) {
      if (isAbortError(error)) {
        console.log(`Task with key '${key}' was aborted.`);
      } else {
        console.error(`Error in task with key '${key}':`, error);
      }
    }
  });
}

export function abortTask(key: string) {
  if (abortControllers[key]) {
    console.log(`Aborting running task with key '${key}'...`);
    try {
      (abortControllers[key] as AbortController).abort();
    } catch (error) {
      // Ignore AbortError - it's expected when aborting
      if (!isAbortError(error)) {
        throw error;
      }
    }
    delete abortControllers[key];
  } else {
    console.log(`No running task with key '${key}' to abort.`);
  }
}
