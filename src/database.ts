import pg from "pg";
import config from "./config.js";

export const Database = new pg.Client(`postgres://${encodeURIComponent(config.DB_USER)}:${encodeURIComponent(config.DB_PASS)}@${config.DB_HOST}/${encodeURIComponent(config.DB_NAME)}`)
