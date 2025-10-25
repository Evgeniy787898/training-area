import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function parseAllowedHosts(value) {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map(host => host.trim())
        .filter(Boolean);
}

function resolveProxyTarget(env) {
    const explicitProxy = env.VITE_DEV_API_PROXY_TARGET?.trim();
    if (explicitProxy) {
        return explicitProxy;
    }

    const apiBaseUrl = env.VITE_API_BASE_URL?.trim();
    if (apiBaseUrl) {
        return apiBaseUrl;
    }

    return 'http://localhost:3000';
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const allowedHosts = parseAllowedHosts(env.VITE_ALLOWED_HOSTS);
    const proxyTarget = resolveProxyTarget(env);
    const port = Number.parseInt(env.VITE_PORT ?? '3001', 10);
    const host = env.VITE_DEV_HOST?.trim() || true;

    return {
        plugins: [react()],
        server: {
            port,
            host,
            allowedHosts: allowedHosts.length > 0 ? allowedHosts : true,
            proxy: {
                '/v1': {
                    target: proxyTarget,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        preview: {
            allowedHosts: allowedHosts.length > 0 ? allowedHosts : true,
        },
        build: {
            outDir: 'dist',
            sourcemap: true,
        },
    };
});

