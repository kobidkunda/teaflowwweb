module.exports = {
  apps: [
    {
      name: "teafloww",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3050 -H localhost",
      cwd: "/www/wwwroot/teafloww.com",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3050,
        DATABASE_TYPE: "postgres",
        PGHOST: "localhost",
        PGPORT: 5433,
        PGUSER: "teafloww",
        PGPASSWORD: "teafloww",
        PGDATABASE: "teafloww",
        NEXT_DIST_DIR: ".next",
        NEXT_ASSET_PREFIX: "",
      },
      max_memory_restart: "600M",
      restart_delay: 2000,
      autorestart: true,
    },
  ],
};
