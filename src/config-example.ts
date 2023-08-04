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

const defaultConfig: AppConfig = {
  PORT: 3672,
  HOST: '127.0.0.1',

  DB_HOST: '',
  DB_USER: '',
  DB_PASS: '',
  WS_SERVER_KEY: '',
  ORIGIN_REGEX: /^(https:\/\/mlpvector\.lc|http:\/\/localhost)/,

  CF_KEY: '',

  // For development only
  LOCALHOST: true,
};
