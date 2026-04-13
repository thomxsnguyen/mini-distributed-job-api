import { Router, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { CreateJobInput, Job } from "../models/job.js";

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
