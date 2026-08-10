module.exports = {
  apps: [
    {
      name: "photowall",
      cwd: "/home/kim/PhotoWall",
      script: "scripts/pm2-run-next.cjs",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      // Fail fast if BUILD_ID is missing instead of thrashing for minutes.
      max_restarts: 3,
      min_uptime: "10s",
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
    },
  ],
};
