import { pool } from "./db/pool.js";
import type { Job } from "./models/job.js";
import { redis } from "./redis/client.js";

let isRunning = true;
let isProcessing = false;

process.on("SIGINT", async () => {
  console.log("\nShutdown signal recieved...");
  isRunning = false;

  if (!isProcessing) {
    console.log("No job in progress, shutting down immediately");
    process.exit(0);
  }

  console.log("Finishing current job before shutting down");
});

process.on("SIGTERM", async () => {
  console.log("\nSIGTERM recieved...");
  isRunning = false;
});

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
  console.log("Waiting for jobs...");

  const result = await redis.brpop("job_queue", 30);

  if (!result) {
    return;
  }

  const jobId = result[1];
  console.log(`Picked up job ${jobId} from Redis`);
  isProcessing = true;

  const client = await pool.connect();
  try {
    //grab one pending job and lock it so no other worker touches
    const result = await client.query<Job>(
      `UPDATE jobs
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = $1 and status = 'PENDING'
      RETURNING *`,
      [jobId],
    );

    if (result.rows.length === 0) {
      isProcessing = false;
      return; // no jobs avaliable, there are no rows
    }

    try {
      const job = result.rows[0];
      if (!job) {
        console.log("No jobs avaliable");
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

      if (newStatus === "FAILED") {
        await redis.lpush("job_queue", job.id);
        console.log(`Job ${job.id} requeued for retry`);
      }

      await pool.query(
        `UPDATE jobs
        SET status = $1, attempts = $2, error = $3, updated_at = NOW()
        WHERE id = $4`,
        [newStatus, newAttempts, error, job.id],
      );
      console.log(`Job ${job.id} ${newStatus} after ${newAttempts} attempts`);
    }
  } catch (err) {
    console.error("Worker error:", err);
  } finally {
    client.release();
    isProcessing = false;

    if (!isRunning) {
      console.log("Job finished, shutting down now");
      process.exit(0);
    }
  }
}

async function startWorker(): Promise<void> {
  console.log("Worker started, waiting for jobs via Redis....");
  while (isRunning) {
    await pickUpJob();
  }
  console.log("Worker stopped");
  process.exit(0);
}

startWorker();
