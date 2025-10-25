import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function resolveAllowedHosts(env) {
    const hosts = new Set(['localhost', '127.0.0.1', 'ngrok-free.app', 'ngrok-free.dev']);

    const configuredHosts = env.VITE_ALLOWED_HOSTS || env.ALLOWED_HOSTS || '';
    configuredHosts
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => hosts.add(value));

    if (env.NGROK_DOMAIN) {
        hosts.add(env.NGROK_DOMAIN.trim());
    }

    if (env.VITE_NGROK_DOMAIN) {
        hosts.add(env.VITE_NGROK_DOMAIN.trim());
    }

    return Array.from(hosts);
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devPort = Number(env.VITE_DEV_SERVER_PORT || env.PORT || 3001);
    const host = env.VITE_DEV_SERVER_HOST || env.HOST || '0.0.0.0';

    return {
        plugins: [react()],
        server: {
            port: devPort,
            host,
            allowedHosts: resolveAllowedHosts(env),
        },
        build: {
            outDir: 'dist',
            sourcemap: true,
        },
    };
});

