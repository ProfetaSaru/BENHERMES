module.exports = {
  apps: [
    {
      name: 'benhermes',
      script: 'server/index.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        DATA_DIR: process.env.DATA_DIR || './data',
        TRUST_PROXY: process.env.TRUST_PROXY || 'true',
        ALLOWED_IPS:
          process.env.ALLOWED_IPS ||
          '2804:431:80f7:7700::/48,2804:1b3:a5e7:c3c7::/48,201.93.163.133,2804:1b3:a5e7:2c83::/48,201.93.159.169,2804:1b3:a5e7:8e38::/48,127.0.0.1,::1',
      },
    },
  ],
};

