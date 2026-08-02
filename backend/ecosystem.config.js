module.exports = {
    apps: [
        {
            name: 'messenger-api',
            script: './src/index.js',
            instances: 'max',
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            error_file: './logs/api-error.log',
            out_file: './logs/api-out.log',
            log_file: './logs/api-combined.log',
            time: true
        },
        {
            name: 'messenger-worker',
            script: './src/workers/index.js',
            instances: 1,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            },
            error_file: './logs/worker-error.log',
            out_file: './logs/worker-out.log',
            time: true
        },
        {
            name: 'messenger-scheduler',
            script: './src/scheduler/index.js',
            instances: 1,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            },
            error_file: './logs/scheduler-error.log',
            out_file: './logs/scheduler-out.log',
            time: true
        }
    ]
};