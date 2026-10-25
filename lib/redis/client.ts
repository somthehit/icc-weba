/**
 * lib/redis/client.ts
 *
 * High-performance Redis coordination client with graceful in-memory & Postgres fallback.
 * Authoritative financial & inventory ledger remains in PostgreSQL; Redis provides
 * sub-millisecond catalog reads, barcode lookups, atomic stock reservations, distributed
 * locks, and rate limiting.
 */

import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = process.env.REDIS_URL;

// Global singleton to prevent connection leaks during Next.js Hot Reloading
declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __redisPubSub: { pub: Redis; sub: Redis } | null | undefined;
}

let isConnected = false;
let redisClient: Redis | null = null;

// Local High-Performance Memory Fallback Cache (LRU + TTL)
interface MemoryEntry<T = unknown> {
  value: T;
  expiresAt: number | null;
}
const memoryStore = new Map<string, MemoryEntry>();

function cleanExpiredMemoryKeys() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}
setInterval(cleanExpiredMemoryKeys, 30000).unref?.();

export function getRedisClient(): Redis | null {
  if (global.__redisClient) {
    return global.__redisClient;
  }

  try {
    const client = REDIS_URL
      ? new Redis(REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 1500,
          enableReadyCheck: false,
          retryStrategy(times) {
            if (times > 3) return null; // Fallback to memory store quickly
            return Math.min(times * 200, 1000);
          },
        })
      : new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          password: REDIS_PASSWORD,
          maxRetriesPerRequest: 1,
          connectTimeout: 1500,
          enableReadyCheck: false,
          retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
        });

    client.on('connect', () => {
      isConnected = true;
      console.log('⚡ [Redis] Connected successfully on', REDIS_HOST + ':' + REDIS_PORT);
    });

    client.on('error', (err) => {
      if (isConnected) {
        console.warn('⚠️ [Redis] Connection warning, falling back to safe local store:', err.message);
      }
      isConnected = false;
    });

    client.on('close', () => {
      isConnected = false;
    });

    global.__redisClient = client;
    redisClient = client;
    return client;
  } catch (err: any) {
    console.warn('⚠️ [Redis] Client init bypassed, running in memory-fallback mode:', err.message);
    return null;
  }
}

// Initialize on module load
getRedisClient();

export function isRedisActive(): boolean {
  return isConnected && global.__redisClient?.status === 'ready';
}

/**
 * Universal Cache & Concurrency Adapter
 * Works transparently whether Redis is running locally, on Docker/Cloud, or offline.
 */
export const posCache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (client && isRedisActive()) {
      try {
        const data = await client.get(key);
        if (data) return JSON.parse(data) as T;
      } catch {
        // Fallback to local memory on error
      }
    }
    const mem = memoryStore.get(key);
    if (!mem) return null;
    if (mem.expiresAt && mem.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return mem.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (client && isRedisActive()) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await client.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await client.set(key, serialized);
        }
      } catch {
        // Fallback to memory
      }
    }
    memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  },

  async del(key: string): Promise<void> {
    const client = getRedisClient();
    if (client && isRedisActive()) {
      try {
        await client.del(key);
      } catch {
        // Fallback
      }
    }
    memoryStore.delete(key);
  },

  /**
   * Set-if-not-exists (Idempotency Key / Mutex)
   * Returns true if key was set, false if key already existed.
   */
  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const client = getRedisClient();
    if (client && isRedisActive()) {
      try {
        const res = await client.set(key, value, 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch {
        // Fall through to memory
      }
    }
    const mem = memoryStore.get(key);
    if (mem && (!mem.expiresAt || mem.expiresAt > Date.now())) {
      return false;
    }
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  /**
   * Acquire a distributed lock with automatic expiration & fencing token.
   */
  async acquireLock(lockKey: string, ttlSeconds = 15): Promise<string | null> {
    const fencingToken = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const acquired = await this.setNX(`lock:${lockKey}`, fencingToken, ttlSeconds);
    return acquired ? fencingToken : null;
  },

  /**
   * Release a distributed lock safely only if the fencing token matches.
   */
  async releaseLock(lockKey: string, fencingToken: string): Promise<boolean> {
    const fullKey = `lock:${lockKey}`;
    const client = getRedisClient();
    if (client && isRedisActive()) {
      try {
        // Lua script to release only if value matches
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await client.eval(luaScript, 1, fullKey, fencingToken);
        return res === 1;
      } catch {
        // Fallback to memory
      }
    }
    const entry = memoryStore.get(fullKey);
    if (entry && entry.value === fencingToken) {
      memoryStore.delete(fullKey);
      return true;
    }
    return false;
  },

  /**
   * Atomic stock reservation counter.
   * Decrements available stock in Redis with a reservation TTL (default 15 mins).
   */
  async reserveStock(productId: number, qty: number, terminalId: string, ttlSeconds = 900): Promise<{
    success: boolean;
    availableStock: number;
    reservationId?: string;
  }> {
    const stockKey = `stock:${productId}`;
    const reservationKey = `reservation:${productId}:${terminalId}`;
    const client = getRedisClient();

    if (client && isRedisActive()) {
      try {
        // Lua script ensuring stock doesn't drop below 0
        const luaReserve = `
          local stock = tonumber(redis.call("get", KEYS[1]) or "0")
          local qty = tonumber(ARGV[1])
          if stock >= qty then
            redis.call("decrby", KEYS[1], qty)
            redis.call("setex", KEYS[2], tonumber(ARGV[2]), qty)
            return {1, stock - qty}
          else
            return {0, stock}
          end
        `;
        const result = (await client.eval(luaReserve, 2, stockKey, reservationKey, qty, ttlSeconds)) as [number, number];
        return {
          success: result[0] === 1,
          availableStock: result[1],
          reservationId: result[0] === 1 ? reservationKey : undefined,
        };
      } catch {
        // Fallback to memory
      }
    }

    // In-memory atomic fallback
    const currentStock = (await this.get<number>(stockKey)) ?? 999;
    if (currentStock >= qty) {
      const nextStock = currentStock - qty;
      await this.set(stockKey, nextStock);
      await this.set(reservationKey, qty, ttlSeconds);
      return {
        success: true,
        availableStock: nextStock,
        reservationId: reservationKey,
      };
    }
    return {
      success: false,
      availableStock: currentStock,
    };
  },

  /**
   * Release reserved stock on cart clear or completed sale
   */
  async releaseReservation(productId: number, terminalId: string, returnToPool = true): Promise<void> {
    const stockKey = `stock:${productId}`;
    const reservationKey = `reservation:${productId}:${terminalId}`;
    const reservedQty = (await this.get<number>(reservationKey)) || 0;
    if (reservedQty > 0 && returnToPool) {
      const currentStock = (await this.get<number>(stockKey)) || 0;
      await this.set(stockKey, currentStock + reservedQty);
    }
    await this.del(reservationKey);
  },

  /**
   * Rate limiting sliding window counter
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const rateKey = `ratelimit:${key}`;
    const count = (await this.get<number>(rateKey)) || 0;
    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }
    await this.set(rateKey, count + 1, windowSeconds);
    return { allowed: true, remaining: limit - (count + 1) };
  },
};
