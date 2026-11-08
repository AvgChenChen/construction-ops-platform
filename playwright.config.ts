import 'dotenv/config';
import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{actionTimeout:10000,baseURL:process.env.APP_ORIGIN??'http://127.0.0.1:3000',headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',viewport:{width:1440,height:1100}},workers:1,reporter:'list'});
