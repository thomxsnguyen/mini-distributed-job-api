export type JobStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "dead_letter";

export interface Job {
  id: number;
  type: string;
  payload: any;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJobInput {
  type: string;
  payload: any;
  max_attempts?: number;
}
