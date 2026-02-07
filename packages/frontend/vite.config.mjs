import { sveltekit } from '@sveltejs/kit/vite';
import { exec } from 'child_process';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	server: {
		port: 5173,
		open: process.platform === 'win32'
			? 'http://localhost:5173'
			: true
	}
};

export default config;
