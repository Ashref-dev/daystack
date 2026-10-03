import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',fullyParallel:true,timeout:30000,retries:0,
  use:{baseURL:'http://localhost:5174',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:900}}},{name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}}],
  webServer:{command:'PORT=5174 HOST=127.0.0.1 bun run start',port:5174,reuseExistingServer:false,timeout:30000}
});
