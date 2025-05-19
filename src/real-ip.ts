import fetch from 'node-fetch';
import ipRangeCheck from 'range_check';
import log from './log.js';
import { Socket } from 'socket.io';

const state: { ranges: string[], fetched: boolean } = { ranges: ['127.0.0.0/24'], fetched: false };

const getIPs = (): Promise<string[]> => Promise.all([
  fetch('https://www.cloudflare.com/ips-v4').then(r => r.text()),
  fetch('https://www.cloudflare.com/ips-v6').then(r => r.text()),
]).then((data: string[]) => {
  const [v4, v6] = data.map(list => list.trim().split('\n'));
  return [...v4, ...v6];
});

let fetchPromise: Promise<void> | undefined;

const findRealIp = async (socket: Socket): Promise<string | null> => {
  if (!state.fetched) {
    if (!fetchPromise) {
      fetchPromise = getIPs().then(data => {
        state.ranges = [...state.ranges, ...data];
        state.fetched = true;
        log(`[real-ip] Got ${state.ranges.length} CloudFlare ranges`);
      });
    }
    await fetchPromise;
  }
  let remoteAddress: string | null = null;
  const connectionAddress = socket.request.connection.remoteAddress;
  if (connectionAddress) {
    remoteAddress = ipRangeCheck.storeIP(connectionAddress);
    const realIpHeader = socket.client.request.headers?.['x-real-ip'];
    if (typeof realIpHeader === 'string') {
      const realIp = ipRangeCheck.storeIP(realIpHeader);
      try {
        if (remoteAddress && ipRangeCheck.inRange(remoteAddress, state.ranges))
          remoteAddress = realIp;
      }
      catch (e) {
        console.error(`Invalid CloudFlare IP received: ${remoteAddress} (${e})\n${(e as Error).stack}`);
      }
    }
  }
  return remoteAddress;
};

export default findRealIp;
