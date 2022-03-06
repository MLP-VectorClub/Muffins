export interface AppConfig {
  PORT: number,
  HOST: string,

  DB_HOST: string,
  DB_USER: string,
  DB_PASS: string,
  WS_SERVER_KEY: string,
  ORIGIN_REGEX: RegExp,

  LE_SERVER: string,
  LE_EMAIL: string,
  LE_DOMAINS: string[],
  CF_KEY: string,

  // For development only
  LOCALHOST: boolean,
  SSL_CERT: string,
  SSL_KEY: string,
}

const defaultConfig: AppConfig = {
  PORT: 8443,
  HOST: '127.0.0.1',

  DB_HOST: '',
  DB_USER: '',
  DB_PASS: '',
  WS_SERVER_KEY: '',
  ORIGIN_REGEX: /^(https:\/\/mlpvector\.lc|http:\/\/localhost)/,

  LE_SERVER: 'staging',
  LE_EMAIL: '',
  LE_DOMAINS: ['ws.mlpvector.lc'],
  CF_KEY: '',

  // For development only
  LOCALHOST: true,
  SSL_CERT: "/path/to/ssl.crt",
  SSL_KEY: "/path/to/ssl.key",
};
