import { createWebHandler } from './web.js';
import { D1RunStore } from './core/d1-store.js';
import { CapabilitySigner } from './core/capability.js';
import { Broker } from './core/broker.js';

let handler;
function getHandler(env) {
  if (!handler) handler = createWebHandler({ assets: env.ASSETS, store: env.DB ? new D1RunStore(env.DB) : undefined, broker: new Broker({ fixtureMode: env.RANDOMWARE_FIXTURES === '1' }), signer: new CapabilitySigner(env.RANDOMWARE_SIGNING_SECRET || 'worker-development-secret') });
  return handler;
}

export default {
  async fetch(request, env) {
    return getHandler(env)(request, env);
  }
};
