import { createWebHandler } from './web.js';

let handler;
function getHandler(env) {
  if (!handler) handler = createWebHandler({ assets: env.ASSETS });
  return handler;
}

export default {
  async fetch(request, env) {
    return getHandler(env)(request, env);
  }
};
