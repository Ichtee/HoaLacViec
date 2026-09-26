/**
 * Migration Script for MicroTasks Schema Synchronization
 * - Normalizes legacy tasks with defaults (paymentMethod, itemBudget, isDeleted)
 * - Converts legacy string deadlines into structured deadlineDate
 * - Auto-marks overdue open tasks as expired
 * - Ensures audit history array exists
 * - 100% Idempotent
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MicroTask } from '../models/MicroTask.js';
import { TASK_STATUSES } from '../utils/taskContract.js';

dotenv.config();

export async function runTaskMigration(options = {}) {
  const isApply = Boolean(options.apply || process.argv.includes('--apply'));
  console.log(`[TaskMigration] Starting MicroTask schema migration (Mode: ${isApply ? 'APPLY' : 'DRY-RUN'})...`);

  const tasks = await MicroTask.find({});
  let updatedCount = 0;
  let expiredCount = 0;
  const now = new Date();

  for (const task of tasks) {
    let changed = false;

    // 1. Ensure isDeleted flag
    if (task.isDeleted === undefined) {
      task.isDeleted = false;
      changed = true;
    }

    // 2. Ensure paymentMethod
    if (!task.paymentMethod) {
      task.paymentMethod = 'cash';
      changed = true;
    }

    // 3. Ensure itemBudget
    if (task.itemBudget === undefined || task.itemBudget === null) {
      task.itemBudget = 0;
      changed = true;
    }

    // 4. Ensure deadlineDate
    if (!task.deadlineDate) {
      const parsed = new Date(task.deadline || task.createdAt || now);
      if (!isNaN(parsed.getTime())) {
        task.deadlineDate = parsed;
      } else {
        // Default to createdAt + 24h
        const defaultD = new Date(task.createdAt || now);
        defaultD.setHours(defaultD.getHours() + 24);
        task.deadlineDate = defaultD;
      }
      changed = true;
    }

    // 5. Auto-expire overdue open tasks
    if (task.status === TASK_STATUSES.OPEN && task.deadlineDate < now) {
      task.status = TASK_STATUSES.EXPIRED;
      expiredCount++;
      changed = true;
    }

    // 6. Ensure history array
    if (!Array.isArray(task.history)) {
      task.history = [
        {
          status: task.status || TASK_STATUSES.OPEN,
          changedBy: task.requesterId,
          note: 'Khởi tạo từ hệ thống cũ',
          timestamp: task.createdAt || now,
        },
      ];
      changed = true;
    }

    if (changed) {
      updatedCount++;
      if (isApply) {
        await task.save();
      }
    }
  }

  console.log(`[TaskMigration] Finished: ${tasks.length} total tasks checked, ${updatedCount} normalized, ${expiredCount} expired.`);
  return { total: tasks.length, updated: updatedCount, expired: expiredCount };
}

// Execute directly if run via CLI
if (process.argv[1] && process.argv[1].endsWith('migrateTasks.js')) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hoalacviec';
  mongoose.connect(mongoUri)
    .then(async () => {
      await runTaskMigration({ apply: true });
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[TaskMigration] Error:', err);
      process.exit(1);
    });
}
