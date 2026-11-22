import { createServer } from 'node:http';
import type { Server } from 'socket.io';

import config from './config.js';
import log from './log.js';
import { AppSocket } from './common-types.js';

/**
 * Prometheus metrics, on their OWN port (METRICS_PORT, unset = disabled): the main port is published through the ingress, this one never is.
 *
 * Anonymous by construction: only aggregates are exported. Nothing identifying a visitor (socket id, IP or its hash, user id or name, cookies,
 * the raw page path) is ever a label or a value; "unique networks" and "signed-in users" are plain counts of distinct values computed on each scrape.
 * Labels come from small bounded sets (a fixed origin list, role names, the first path segment) and every dimension is capped, because a few of
 * them are filled from client-supplied strings.
 */

const MAX_VALUES_PER_LABEL = 32;

const counters = {
  connections: 0,
  disconnects: 0,
  authGuest: 0,
  authUser: 0,
  notifyPushes: 0,
};

export type CounterName = keyof typeof counters;
export const count = (name: CounterName) => {
  counters[name]++;
};

/** `/club/events/12` -> `club`; anything that does not look like a plain section name is `other`, so a client cannot make up label values */
const pageSection = (page: string | undefined) => {
  if (typeof page !== 'string' || page === '' || page === '/')
    return 'home';
  const first = page.split(/[/?#]/).find(part => part !== '') ?? '';
  return /^[a-z][a-z0-9-]{0,23}$/.test(first) ? first : 'other';
};

/** Only the front ends this server accepts (ORIGIN_REGEX) get through the handshake, but the label is still reduced to the host */
const originHost = (origin: string | undefined) => {
  if (!origin) return 'none';
  try {
    return new URL(origin).hostname.replace(/[^a-z0-9.-]/gi, '').slice(0, 40) || 'none';
  } catch {
    return 'invalid';
  }
};

/** Counts per label value, the (MAX_VALUES_PER_LABEL+1)th and later distinct values are folded into "other" */
const tally = (values: Iterable<string>) => {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = result.has(value) || result.size < MAX_VALUES_PER_LABEL ? value : 'other';
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
};

const escapeLabel = (value: string) => value.replace(/[\\"\n]/g, ' ');

const render = (io: Server) => {
  const sockets = [...io.sockets.sockets.values()] as AppSocket[];
  const lines: string[] = [];
  const metric = (name: string, type: 'gauge' | 'counter', help: string) => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
  };
  const series = (name: string, value: number, labels: Record<string, string> = {}) => {
    const rendered = Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',');
    lines.push(`${name}${rendered ? `{${rendered}}` : ''} ${value}`);
  };
  const byLabel = (name: string, help: string, label: string, values: string[]) => {
    metric(name, 'gauge', help);
    const counts = tally(values);
    if (counts.size === 0) series(name, 0, { [label]: 'none' });
    for (const [value, n] of counts) series(name, n, { [label]: value });
  };

  // `role` is only set once a socket has authenticated: guests (and sockets still waiting for Luna's answer) have none
  const roleOf = (s: AppSocket) => s.data.user?.role ?? 'guest';

  metric('muffins_connected_sockets', 'gauge', 'Open WebSocket connections (a visitor with two tabs counts twice)');
  series('muffins_connected_sockets', sockets.length);

  byLabel('muffins_sockets_by_role', 'Open connections by account role (guest = not signed in)', 'role', sockets.map(roleOf));
  byLabel('muffins_sockets_by_origin', 'Open connections by front end host', 'origin', sockets.map(s => originHost(s.data.origin)));
  byLabel('muffins_sockets_by_page', 'Open connections by first path segment of the page being viewed', 'section', sockets.map(s => pageSection(s.data.page)));

  // Distinct salted hashes of the client address: how many separate visitors, not who (the hash itself never leaves the process)
  const networks = new Set<string>();
  const users = new Set<string>();
  for (const s of sockets) {
    if (s.data.network) networks.add(s.data.network);
    if (s.data.user?.role && s.data.user.role !== 'server') users.add(s.data.user.id);
  }
  metric('muffins_unique_networks', 'gauge', 'Distinct client networks with an open connection (count only)');
  series('muffins_unique_networks', networks.size);
  // Same count per front end (old Winterchilla site vs the current one): distinct hashes per origin, still only numbers
  const networksByOrigin = new Map<string, Set<string>>();
  for (const s of sockets) {
    if (!s.data.network) continue;
    const key = originHost(s.data.origin);
    if (!networksByOrigin.has(key) && networksByOrigin.size >= MAX_VALUES_PER_LABEL) continue;
    networksByOrigin.set(key, (networksByOrigin.get(key) ?? new Set<string>()).add(s.data.network));
  }
  metric('muffins_unique_networks_by_origin', 'gauge', 'Distinct client networks with an open connection, per front end host (count only)');
  if (networksByOrigin.size === 0) series('muffins_unique_networks_by_origin', 0, { origin: 'none' });
  for (const [origin, set] of networksByOrigin) series('muffins_unique_networks_by_origin', set.size, { origin });
  metric('muffins_signed_in_users', 'gauge', 'Distinct signed-in accounts with an open connection (count only)');
  series('muffins_signed_in_users', users.size);

  const ages = sockets.map(s => (s.data.connected ? (Date.now() - s.data.connected.getTime()) / 1000 : 0)).sort((a, b) => a - b);
  metric('muffins_connection_age_seconds_median', 'gauge', 'Median age of the open connections');
  series('muffins_connection_age_seconds_median', ages.length ? ages[Math.floor(ages.length / 2)] : 0);

  const counter = (name: string, help: string, value: number, labels?: Record<string, string>) => {
    metric(name, 'counter', help);
    series(name, value, labels);
  };
  counter('muffins_connections_total', 'Connections accepted since the process started', counters.connections);
  counter('muffins_disconnects_total', 'Connections closed since the process started', counters.disconnects);
  metric('muffins_auth_total', 'counter', 'Authentication outcomes of new connections');
  series('muffins_auth_total', counters.authGuest, { result: 'guest' });
  series('muffins_auth_total', counters.authUser, { result: 'user' });
  counter('muffins_notify_pushes_total', 'Notification count pushes requested by Luna (POST /notify)', counters.notifyPushes);

  const mem = process.memoryUsage();
  metric('muffins_process_resident_memory_bytes', 'gauge', 'Resident set size');
  series('muffins_process_resident_memory_bytes', mem.rss);
  metric('muffins_process_heap_used_bytes', 'gauge', 'V8 heap in use');
  series('muffins_process_heap_used_bytes', mem.heapUsed);
  metric('muffins_process_uptime_seconds', 'gauge', 'Seconds since the process started');
  series('muffins_process_uptime_seconds', process.uptime());

  return lines.join('\n') + '\n';
};

export const startMetricsServer = (io: Server) => {
  if (!config.METRICS_PORT)
    return;

  createServer((req, res) => {
    if (req.method !== 'GET' || req.url?.split('?')[0] !== '/metrics') {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(render(io));
  }).listen(config.METRICS_PORT, config.HOST);
  log(`[Metrics] Listening on ${config.HOST}:${config.METRICS_PORT}`);
};
