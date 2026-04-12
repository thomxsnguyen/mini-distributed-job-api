import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000, // connection has been sitting unused for 30 seconds, close it
  connectionTimeoutMillis: 2000, // app returns error after 2 seconds instead of waiting
});

pool.on("error", (err) => {
  // if connection dies unexpectedly, log the error and exit the process
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
