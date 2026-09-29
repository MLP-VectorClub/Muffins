import { existsSync } from 'node:fs';
import { z } from 'zod';

// Resolved relative to this module so it works from both src/ (tsx) and build/,
// regardless of the directory pm2 was started from
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile))
  process.loadEnvFile(envFile);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3672),
  HOST: z.string().min(1).default('127.0.0.1'),

  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  WS_SERVER_KEY: z.string().min(1),
  ORIGIN_REGEX: z.string().min(1).default('^(https://mlpvector\\.lc|http://localhost)').transform((value, ctx) => {
    try {
      return new RegExp(value);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  }),
});

const result = envSchema.safeParse(process.env);
if (!result.success)
  throw new Error(`Invalid environment variables, see .env.example\n${z.prettifyError(result.error)}`);

const config = result.data;

export default config;
