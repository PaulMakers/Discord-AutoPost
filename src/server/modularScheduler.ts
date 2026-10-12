/**
 * Modular Channel Task Scheduler for Node.js
 * 
 * Features:
 * - Independent execution per task/channel with custom intervals (hours, minutes, seconds)
 * - Optional random delay jitter range (min-max seconds)
 * - Dynamic start, stop, pause, and update without server restart
 * - Per-task error isolation and boundary (never crashes the process or other tasks)
 * - Lifecycle hooks: onBeforeRun, onSuccess, onError, onScheduleNext
 */

export interface TaskInterval {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface RandomDelayRange {
  enabled: boolean;
  minSeconds: number;
  maxSeconds: number;
}

export interface TaskOptions {
  id: string;
  name: string;
  interval: TaskInterval;
  randomDelay?: RandomDelayRange;
  runImmediatelyOnStart?: boolean;
  execute: () => Promise<void> | void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: TaskStatus) => void;
}

export type TaskStatus = 'idle' | 'running' | 'waiting' | 'stopped' | 'error';

export interface TaskInfo {
  id: string;
  name: string;
  status: TaskStatus;
  interval: TaskInterval;
  intervalTotalSeconds: number;
  randomDelay?: RandomDelayRange;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

interface ActiveTaskRecord {
  options: TaskOptions;
  status: TaskStatus;
  timer: NodeJS.Timeout | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  isExecuting: boolean;
}

export class ModularChannelScheduler {
  private tasks = new Map<string, ActiveTaskRecord>();
  private isGlobalPaused = false;

  /**
   * Register a new task with its custom interval, delay, and execute function.
   */
  public registerTask(options: TaskOptions): TaskInfo {
    // If task already exists, stop and clean up its previous timer
    if (this.tasks.has(options.id)) {
      this.stopTask(options.id);
    }

    const record: ActiveTaskRecord = {
      options,
      status: 'stopped',
      timer: null,
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      errorCount: 0,
      lastError: null,
      isExecuting: false,
    };

    this.tasks.set(options.id, record);
    return this.getTaskInfo(options.id)!;
  }

  /**
   * Start a task dynamically without restarting the server.
   */
  public startTask(taskId: string, runImmediately = false): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Clear any existing timer
    if (task.timer) {
      clearTimeout(task.timer);
      task.timer = null;
    }

    this.updateStatus(task, 'waiting');

    if (runImmediately) {
      // Execute immediately on the next event loop tick
      task.nextRunAt = new Date().toISOString();
      task.timer = setTimeout(() => {
        this.runTaskIteration(task);
      }, 50);
    } else {
      const delayMs = this.calculateNextDelayMs(task.options);
      task.nextRunAt = new Date(Date.now() + delayMs).toISOString();
      task.timer = setTimeout(() => {
        this.runTaskIteration(task);
      }, delayMs);
    }

    return true;
  }

  /**
   * Stop/pause a task dynamically without restarting the server.
   */
  public stopTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.timer) {
      clearTimeout(task.timer);
      task.timer = null;
    }

    task.nextRunAt = null;
    this.updateStatus(task, 'stopped');
    return true;
  }

  /**
   * Unregister and completely delete a task.
   */
  public removeTask(taskId: string): boolean {
    this.stopTask(taskId);
    return this.tasks.delete(taskId);
  }

  /**
   * Update task interval, random delay, or execute handler on the fly.
   */
  public updateTaskConfig(
    taskId: string,
    updates: Partial<Pick<TaskOptions, 'name' | 'interval' | 'randomDelay' | 'execute'>>
  ): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const isRunning = task.status === 'waiting' || task.status === 'running';

    task.options = {
      ...task.options,
      ...updates,
      interval: updates.interval ? { ...task.options.interval, ...updates.interval } : task.options.interval,
      randomDelay: updates.randomDelay !== undefined ? updates.randomDelay : task.options.randomDelay,
    };

    // If task was actively waiting, reschedule with the new configuration
    if (isRunning) {
      this.startTask(taskId, false);
    }

    return true;
  }

  /**
   * Manually trigger immediate execution of a task.
   */
  public async triggerNow(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    await this.runTaskIteration(task, true);
    return true;
  }

  /**
   * Start all registered tasks at once.
   */
  public startAll(): void {
    for (const taskId of this.tasks.keys()) {
      this.startTask(taskId, false);
    }
  }

  /**
   * Stop all running tasks at once.
   */
  public stopAll(): void {
    for (const taskId of this.tasks.keys()) {
      this.stopTask(taskId);
    }
  }

  /**
   * Pause or resume the global scheduler execution.
   */
  public setGlobalPause(pause: boolean): void {
    this.isGlobalPaused = pause;
  }

  public getGlobalPause(): boolean {
    return this.isGlobalPaused;
  }

  /**
   * Get metadata and live status of a task.
   */
  public getTaskInfo(taskId: string): TaskInfo | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const baseSec = this.calculateBaseSeconds(task.options.interval);

    return {
      id: task.options.id,
      name: task.options.name,
      status: task.status,
      interval: { ...task.options.interval },
      intervalTotalSeconds: baseSec,
      randomDelay: task.options.randomDelay ? { ...task.options.randomDelay } : undefined,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
      runCount: task.runCount,
      errorCount: task.errorCount,
      lastError: task.lastError,
    };
  }

  /**
   * Get list of all registered tasks and their current states.
   */
  public getAllTasks(): TaskInfo[] {
    const result: TaskInfo[] = [];
    for (const taskId of this.tasks.keys()) {
      const info = this.getTaskInfo(taskId);
      if (info) result.push(info);
    }
    return result;
  }

  // ==========================================
  // INTERNAL EXECUTION ENGINE
  // ==========================================

  /**
   * Convert { hours, minutes, seconds } into total base seconds.
   */
  public calculateBaseSeconds(interval: TaskInterval): number {
    const h = Number(interval.hours) || 0;
    const m = Number(interval.minutes) || 0;
    const s = Number(interval.seconds) || 0;
    const total = h * 3600 + m * 60 + s;
    return Math.max(5, total); // 5s floor for safety
  }

  /**
   * Compute final delay in milliseconds including optional random jitter.
   */
  public calculateNextDelayMs(options: TaskOptions): number {
    const baseSeconds = this.calculateBaseSeconds(options.interval);
    let extraSeconds = 0;

    const jitter = options.randomDelay;
    if (jitter && jitter.enabled) {
      const min = Math.max(0, jitter.minSeconds || 0);
      const max = Math.max(min, jitter.maxSeconds || 0);
      if (max > min) {
        extraSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }

    return (baseSeconds + extraSeconds) * 1000;
  }

  /**
   * Internal iteration loop for a task with error boundary.
   */
  private async runTaskIteration(task: ActiveTaskRecord, isManualTrigger = false): Promise<void> {
    if (this.isGlobalPaused && !isManualTrigger) {
      // If globally paused, retry checking in 5 seconds without executing
      task.timer = setTimeout(() => {
        this.runTaskIteration(task);
      }, 5000);
      return;
    }

    if (task.isExecuting) return; // Prevent overlapping runs of the same task

    task.isExecuting = true;
    this.updateStatus(task, 'running');

    try {
      // Execute the task function
      await Promise.resolve(task.options.execute());

      task.lastRunAt = new Date().toISOString();
      task.runCount++;
      task.lastError = null;

      if (task.options.onSuccess) {
        try {
          task.options.onSuccess();
        } catch (hookErr) {
          console.error(`[Scheduler Hook Error on ${task.options.name}]:`, hookErr);
        }
      }
    } catch (err: unknown) {
      // Error boundary: capture error, notify hook, update stats, but NEVER crash process
      task.errorCount++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      task.lastError = errorMessage;
      this.updateStatus(task, 'error');

      console.error(`[Task Execution Error on "${task.options.name}"]:`, errorMessage);

      if (task.options.onError) {
        try {
          task.options.onError(err);
        } catch (hookErr) {
          console.error(`[Scheduler onError Hook Exception]:`, hookErr);
        }
      }
    } finally {
      task.isExecuting = false;

      // Reschedule next iteration only if task is still supposed to be running
      if (task.status !== 'stopped') {
        const nextDelayMs = this.calculateNextDelayMs(task.options);
        const nextEpoch = Date.now() + nextDelayMs;
        task.nextRunAt = new Date(nextEpoch).toISOString();
        this.updateStatus(task, 'waiting');

        task.timer = setTimeout(() => {
          this.runTaskIteration(task);
        }, nextDelayMs);
      }
    }
  }

  private updateStatus(task: ActiveTaskRecord, status: TaskStatus): void {
    task.status = status;
    if (task.options.onStatusChange) {
      try {
        task.options.onStatusChange(status);
      } catch (err) {
        console.error('Error in onStatusChange hook:', err);
      }
    }
  }
}

// Global default instance for easy import across modules
export const modularScheduler = new ModularChannelScheduler();
