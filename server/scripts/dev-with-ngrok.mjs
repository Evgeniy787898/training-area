import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const webappDir = path.join(projectRoot, 'webapp');
const serverDir = path.join(projectRoot, 'server');

const DEFAULT_API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const VITE_PORT = Number(process.env.VITE_PORT || '3001');
const NGROK_API = process.env.NGROK_API || 'http://127.0.0.1:4040/api/tunnels';
const NGROK_BIN = process.env.NGROK_BIN || 'ngrok';
const NGROK_REGION = process.env.NGROK_REGION;

const colors = {
    info: '\u001b[36m',
    success: '\u001b[32m',
    warn: '\u001b[33m',
    error: '\u001b[31m',
    reset: '\u001b[0m',
    dim: '\u001b[90m',
};

let shuttingDown = false;
let ngrokProcess = null;
let ngrokUrl = null;
const children = [];

function log(message, color = colors.info) {
    console.log(`${color}${message}${colors.reset}`);
}

function spawnProcess(command, args, options = {}) {
    const child = spawn(command, args, {
        stdio: options.stdio || 'inherit',
        env: { ...process.env, ...options.env },
        cwd: options.cwd || projectRoot,
        shell: process.platform === 'win32',
    });

    children.push(child);

    child.on('exit', (code, signal) => {
        if (!shuttingDown) {
            log(`\n❌ Process ${command} exited with code ${code ?? 'null'} (${signal ?? 'no-signal'})`, colors.error);
            shutdown(1);
        }
    });

    return child;
}

async function waitForHttp(url, timeoutMs = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.ok || response.status >= 200) {
                return true;
            }
        } catch (error) {
            // ignore until timeout
        }
        await delay(1000);
    }
    throw new Error(`Resource ${url} did not respond within ${timeoutMs / 1000}s`);
}

async function waitForNgrokTunnel(timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(NGROK_API);
            if (response.ok) {
                const data = await response.json();
                const tunnels = Array.isArray(data.tunnels) ? data.tunnels : [];
                const tunnel = tunnels.find(item => item.public_url && item.proto === 'https');
                if (tunnel) {
                    return tunnel.public_url;
                }
            }
        } catch (error) {
            // ngrok api might not be ready yet
        }
        await delay(1000);
    }
    throw new Error('Ngrok tunnel not ready');
}

async function startNgrok() {
    const args = ['http', String(VITE_PORT), '--log=stdout'];
    if (NGROK_REGION) {
        args.push('--region', NGROK_REGION);
    }

    ngrokProcess = spawnProcess(NGROK_BIN, args, { stdio: 'ignore' });

    const url = await waitForNgrokTunnel();
    ngrokUrl = url;
    log(`\n🌐 Ngrok tunnel established: ${url}`, colors.success);
    log('    Кнопка /webapp будет вести по этому адресу.', colors.dim);
    return url;
}

async function start() {
    log('\n🚀 Training Bot — Dev Tunnel Launcher');
    log('---------------------------------------', colors.dim);

    log('1️⃣  Запускаю Vite dev server...', colors.info);
    spawnProcess('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(VITE_PORT)], {
        cwd: webappDir,
        env: {
            VITE_API_BASE_URL: DEFAULT_API_BASE,
        },
    });

    await waitForHttp(`http://127.0.0.1:${VITE_PORT}/`);

    log('2️⃣  Поднимаю ngrok-туннель...', colors.info);
    const publicUrl = await startNgrok();

    process.env.WEBAPP_URL = publicUrl;
    process.env.VITE_PUBLIC_WEBAPP_URL = publicUrl;

    log('3️⃣  Запускаю backend + Telegram бота...', colors.info);
    await delay(500);
    spawnProcess('npm', ['run', 'dev'], {
        cwd: serverDir,
        env: {
            WEBAPP_URL: publicUrl,
            VITE_PUBLIC_WEBAPP_URL: publicUrl,
        },
    });

    log('\n✅ Готово! Используй команду /webapp в Telegram, чтобы открыть приложение.', colors.success);
    log('   Если нужно остановить окружение, нажми Ctrl+C.', colors.dim);
}

async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    log('\n⏹️  Останавливаю процессы...', colors.dim);

    for (const child of children) {
        if (!child.killed) {
            try {
                child.kill('SIGTERM');
            } catch (error) {
                log(`Не удалось завершить процесс: ${error.message}`, colors.warn);
            }
        }
    }

    if (ngrokProcess && !ngrokProcess.killed) {
        ngrokProcess.kill('SIGTERM');
        await delay(500);
        ngrokProcess.kill('SIGKILL');
    }

    process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', error => {
    log(`Uncaught exception: ${error.stack || error.message}`, colors.error);
    shutdown(1);
});

start().catch(error => {
    log(`\n❌ Failed to bootstrap dev tunnel: ${error.stack || error.message}`, colors.error);
    shutdown(1);
});
