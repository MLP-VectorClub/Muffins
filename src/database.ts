import pg from "pg";
import config from "./config.js";

export const Database = new pg.Client(`postgres://${config.DB_USER}:${config.DB_PASS}@${config.DB_HOST}/mlpvc-rr`)
