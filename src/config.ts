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
  // `mlpvc-rr` is Winterchilla's database, Luna's own is used once the two share one
  DB_NAME: z.string().min(1).default('mlpvc-rr'),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  WS_SERVER_KEY: z.string().min(1),
  // Where Luna answers from this machine (e.g. http://127.0.0.1:8000), to check the one time tokens its front end hands to browsers; without it only
  // Winterchilla's cookie works
  LUNA_URL: z.url().optional(),
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
