import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { Setting } from '../entities/Setting';
import { API_KEY_SETTING } from '../middleware/apiKeyAuth';

const SALT_ROUNDS = 12;

async function setApiKey(apiKey: string): Promise<void> {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected');

    // Hash the API key
    const hash = await bcrypt.hash(apiKey, SALT_ROUNDS);

    // Save to settings table
    const settingRepository = AppDataSource.getRepository(Setting);

    let setting = await settingRepository.findOne({ where: { key: API_KEY_SETTING } });

    if (setting) {
      setting.value = hash;
      await settingRepository.save(setting);
      console.log('API key updated successfully');
    } else {
      setting = settingRepository.create({
        key: API_KEY_SETTING,
        value: hash
      });
      await settingRepository.save(setting);
      console.log('API key set successfully');
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Failed to set API key:', error);
    process.exit(1);
  }
}

// Get API key from command line argument
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Usage: npm run set-api-key <your-api-key>');
  console.error('');
  console.error('Example: npm run set-api-key my-secret-key-12345');
  process.exit(1);
}

if (apiKey.length < 16) {
  console.error('Error: API key must be at least 16 characters long');
  process.exit(1);
}

setApiKey(apiKey);
