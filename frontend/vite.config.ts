import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
        proxy: {
            // "When you see /api/ws, don't handle it with Svelte."
            // "Instead, open a pipe directly to the Go backend."
            '/api/ws': {
                target: 'ws://localhost:8080', // Connects to Go
                ws: true,                      // Enables the WebSocket protocol
                changeOrigin: true
            }
        }
    }
});
