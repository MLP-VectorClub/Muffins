import { AppConfig } from './app-config.js';

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

export default defaultConfig;
