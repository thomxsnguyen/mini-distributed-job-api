import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6739",
);

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.log("Redis error", err);
});
