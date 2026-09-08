import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

// Initialize Redis directly since this is a script
const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!kvUrl || !kvToken) {
  console.error("Missing UPSTASH_REDIS_REST_URL or KV_REST_API_URL in environment.");
  process.exit(1);
}

const kv = new Redis({
  url: kvUrl,
  token: kvToken,
});

async function migrate() {
  console.log("Starting migration to KV...");

  // Migrate Users
  const usersPath = path.resolve('./src/data/users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    console.log(`Migrating ${users.length} users...`);
    
    for (const user of users) {
      await kv.set(`user:${user.id}`, user);
      await kv.sadd('users:index', user.id);
      console.log(`Migrated user ${user.id}`);
    }
  } else {
    console.log("No users.json found, skipping users migration.");
  }

  // Migrate Requests
  const requestsPath = path.resolve('./src/data/requests.json');
  if (fs.existsSync(requestsPath)) {
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf-8'));
    console.log(`Migrating ${requests.length} requests...`);
    
    for (const req of requests) {
      await kv.set(`request:${req.id}`, req);
      await kv.sadd('requests:index', req.id);
      console.log(`Migrated request ${req.id}`);
    }
  } else {
    console.log("No requests.json found, skipping requests migration.");
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);
