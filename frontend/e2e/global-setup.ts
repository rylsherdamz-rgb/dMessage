import { startLocalRelay } from './local-relay';

export const LOCAL_RELAY_PORT = 7777;

export default async function globalSetup() {
  const stop = startLocalRelay(LOCAL_RELAY_PORT);
  return async () => stop();
}
