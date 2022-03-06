import fetch from 'node-fetch';
import ipRangeCheck from 'range_check';
import log from './log';
import { Socket } from "socket.io";

const state: { ranges: string[], fetched: boolean } = { ranges: [], fetched: false };

const getIPs = (): Promise<string[]> => Promise.all([
  fetch('https://www.cloudflare.com/ips-v4').then(r => r.text()),
  fetch('https://www.cloudflare.com/ips-v6').then(r => r.text()),
]).then((data: string[]) => {
  const [v4, v6] = data.map(list => list.slice(0, -1).split('\n'));
  return [...v4, ...v6];
});

const fetchPromise = getIPs().then(data => {
  state.ranges = data;
  state.fetched = true;
  log(`[real-ip] Got ${state.ranges.length} CloudFlare ranges`);
  return Promise.resolve();
});

const findRealIp = async (socket: Socket): Promise<string | null> => {
  if (!state.fetched) {
    await fetchPromise;
  }
  let remoteAddress: string | null = null;
  const remoteAddressIn = socket.request.connection.remoteAddress;
  if (remoteAddressIn) {
    remoteAddress = ipRangeCheck.storeIP(remoteAddressIn);
    const cfConnectingIpIn = socket.client.request.headers?.['cf-connecting-ip'];
    if (typeof cfConnectingIpIn === 'string') {
      const cfConnectingIp = ipRangeCheck.storeIP(cfConnectingIpIn);
      try {
        if (remoteAddress && ipRangeCheck.inRange(remoteAddress, state.ranges))
          remoteAddress = cfConnectingIp;
      }
      catch (e) {
        console.error(`Invalid CloudFlare IP received: ${remoteAddress} (${e})\n${(e as Error).stack}`);
      }
    }
  }
  return remoteAddress;
};

export default findRealIp;
