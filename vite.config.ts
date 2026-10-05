import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';

// Vercel sets VERCEL=1 during its builds; local runs, Docker and e2e tests keep the Node server.
const adapter = process.env['VERCEL'] ? vercelAdapter({ runtime: 'nodejs24.x' }) : nodeAdapter();
export default defineConfig({ plugins: [sveltekit({ adapter })] });
