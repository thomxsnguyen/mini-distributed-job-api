import { pool } from "./db/pool.js";
import type { Job } from "./models/job.js";

const POLL_INTERVAL_MS = 3000;

// function to simulate processing job, placeholder for actual work later
async function processJob(job: Job): Promise<void> {
  console.log(`Processing job ${job.id} of type ${job.type}`);

  //simulate work taking 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (Math.random() < 0.3) {
    throw new Error(`Simulated failure for job ${job.id}`);
  }

  console.log(`Job ${job.id} completed successfully`);
}

async function pickUpJob(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    //grab one pending job and lock it so no other worker touches
    const result = await client.query<Job>(
      `UPDATE jobs
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = (
        SELECT id FROM jobs
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        )
    RETURNING *`, // returns the full updated row immediately
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return; // no jobs avaliable, there are no rows
    }

    const job = result.rows[0];
    await client.query("COMMIT");

    try {
      const job = result.rows[0];
      if (!job) {
        await client.query("ROLLBACK");
        return;
      }

      await processJob(job);

      // mark as SUCCESS
      await pool.query(
        `UPDATE jobs
        SET status = 'SUCCESS', updated_at = NOW()
        WHERE id = $1`,
        [job.id],
      );
    } catch (err) {
      const job = result.rows[0]!;

      const error = err instanceof Error ? err.message : `Unknown error`;
      const newAttempts = job.attempts + 1;
      const newStatus =
        newAttempts >= job.max_attempts ? "DEAD_LETTER" : "FAILED";

      await pool.query(
        `UPDATE jobs
        SET status = $1, attempts = $2, error = $3, updated_at = NOW()
        WHERE id = $4`,
        [newStatus, newAttempts, error, job.id],
      );
      console.log(`Job ${job.id} ${newStatus} after ${newAttempts} attempts`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Worker error:", err);
  } finally {
    client.release();
  }
}

async function startWorker(): Promise<void> {
  console.log("Worker started, polling every", POLL_INTERVAL_MS, "ms");
  while (true) {
    await pickUpJob();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

startWorker();
