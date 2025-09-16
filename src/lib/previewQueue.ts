type Task = () => Promise<void>;

class PreviewQueue {
  private queue: Task[] = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  enqueue(task: Task) {
    this.queue.push(task);
    this.runNext();
  }

  private runNext() {
    if (this.running >= this.maxConcurrent) return;
    const task = this.queue.shift();
    if (!task) return;
    this.running += 1;
    (async () => {
      try {
        await task();
      } catch {
        // ignore
      } finally {
        this.running -= 1;
        this.runNext();
      }
    })();
  }
}

export const globalPreviewQueue = new PreviewQueue(2);


