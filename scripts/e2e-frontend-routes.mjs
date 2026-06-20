#!/usr/bin/env node

process.env.API_BASE_URL ??= "http://127.0.0.1:3000/api/t3pay";
await import("./e2e-api.mjs");
