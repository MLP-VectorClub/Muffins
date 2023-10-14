export interface AppConfig {
  PORT: number,
  HOST: string,

  DB_HOST: string,
  DB_USER: string,
  DB_PASS: string,
  WS_SERVER_KEY: string,
  ORIGIN_REGEX: RegExp,

  CF_KEY: string,

  // For development only
  LOCALHOST: boolean,
}
