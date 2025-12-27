import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { Setting } from '../entities/Setting';

const API_KEY_SETTING = 'api_key_hash';

// Cache the hash to avoid DB lookups on every request
let cachedApiKeyHash: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

async function getApiKeyHash(): Promise<string | null> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedApiKeyHash && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKeyHash;
  }

  try {
    const settingRepository = AppDataSource.getRepository(Setting);
    const setting = await settingRepository.findOne({ where: { key: API_KEY_SETTING } });

    if (setting) {
      cachedApiKeyHash = setting.value;
      cacheTimestamp = now;
      return cachedApiKeyHash;
    }
  } catch (error) {
    console.error('Failed to fetch API key from database:', error);
  }

  return null;
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized: Missing API key' });
    return;
  }

  const storedHash = await getApiKeyHash();

  if (!storedHash) {
    // No API key configured in database - reject all requests
    console.error('No API key configured in database. Run: npm run set-api-key <your-key>');
    res.status(500).json({ error: 'Server configuration error: No API key configured' });
    return;
  }

  const isValid = await bcrypt.compare(apiKey, storedHash);

  if (!isValid) {
    res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }

  next();
}

// Export for use in set-api-key script
export { API_KEY_SETTING };
