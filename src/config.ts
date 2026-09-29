import { existsSync } from 'node:fs';

// Resolved relative to this module so it works from both src/ (tsx) and build/,
// regardless of the directory pm2 was started from
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile))
  process.loadEnvFile(envFile);

const required = (name: string): string => {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required environment variable ${name}, see .env.example`);
  return value;
};

const config = {
  PORT: Number(process.env.PORT || 3672),
  HOST: process.env.HOST || '127.0.0.1',

  DB_HOST: required('DB_HOST'),
  DB_USER: required('DB_USER'),
  DB_PASS: required('DB_PASS'),
  WS_SERVER_KEY: required('WS_SERVER_KEY'),
  ORIGIN_REGEX: new RegExp(process.env.ORIGIN_REGEX || '^(https://mlpvector\\.lc|http://localhost)'),
};

export default config;
