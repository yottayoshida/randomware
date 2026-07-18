const { createWebHandler } = require('./web');

let handler;
function getHandler(env) {
  if (!handler) handler = createWebHandler({ assets: env.ASSETS, signer: undefined });
  return handler;
}

module.exports = {
  async fetch(request, env) {
    return getHandler(env)(request, env);
  }
};
