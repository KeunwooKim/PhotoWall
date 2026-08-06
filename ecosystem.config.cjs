module.exports = {
  apps: [
    {
      name: 'photowall',
      cwd: '/home/kim/PhotoWall',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      max_restarts: 10,
      min_uptime: '5s',
    },
  ],
};
