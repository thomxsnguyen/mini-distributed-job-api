import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";
import type { CreateJobInput, Job } from "../models/job.js";

const router = Router();

// POST /jobs - submit a new job
router.post("/", async (req: Request, res: Response) => {
  const { type, payload, max_attempts }: CreateJobInput = req.body;

  if (!type) {
    return res.status(400).json({ error: "Job type is required" });
  }

  try {
    const result = await pool.query<Job>(
      "INSERT INTO jobs (type, payload, max_attempts) VALUES ($1, $2, $3) RETURNING *",
      [type, payload, max_attempts || 3],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to create job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /jobs - get all jobs

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    let result;
    if (cursor) {
      result = await pool.query<Job>(
        `SELECT * FROM jobs
       WHERE created_at < $1
       ORDER BY created_at DESC
       LIMIT $2`,
        [cursor, limit + 1],
      );
    } else if (status) {
      result = await pool.query<Job>(
        `SELECT * FROM jobs
        WHERE created_at < $1 AND status = $1
        ORDER BY created_at DESC
        LIMIT $2`,
        [status, limit + 1],
      );
    } else {
      result = await pool.query<Job>(
        `SELECT * FROM jobs
      ORDER BY created_at DESC
      LIMIT $1`,
        [limit + 1],
      );
    }

    const hasMore = result.rows.length > limit;
    const jobs = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? jobs[jobs.length - 1]?.created_at : null;

    return res.json({
      jobs,
      hasMore,
      nextCursor,
      count: jobs.length,
    });
  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /jobs/:id - poll status jobs
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query<Job>("SELECT * FROM jobs WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
