// pm2 on the server: the site (server.mjs) and the GitHub deploy webhook,
// both behind nginx (deploy/nginx-xelle.conf). DEPLOY_SECRET comes from the
// shell when pm2 starts: DEPLOY_SECRET=... pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    { name: 'xelle-site', script: 'server.mjs', env: { PORT: 4173, HOST: '127.0.0.1' } },
    { name: 'xelle-deploy', script: 'deploy/webhook.mjs', env: { PORT: 9000, HOST: '127.0.0.1' } },
  ],
};
