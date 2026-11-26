import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'e2e',use:{baseURL:'http://127.0.0.1:5173',launchOptions:{executablePath:'/home/ubuntu/.local/bin/google-chrome'}},webServer:{command:'pnpm exec vite --host 127.0.0.1',port:5173,reuseExistingServer:true}});
