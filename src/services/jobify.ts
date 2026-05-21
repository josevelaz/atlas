import { initJobify } from "jobify";
import { redis } from "./redis.ts";

export const defineJob = initJobify(redis);
