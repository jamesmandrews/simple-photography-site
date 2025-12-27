import express, { Request, Response } from 'express';
import { AppDataSource } from './data-source';
import photosRouter from './routes/photos';
import collectionsRouter from './routes/collections';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override for clients that can't send DELETE/PUT (e.g., older Lightroom SDKs)
app.use((req, res, next) => {
  const methodOverride = req.headers['x-http-method-override'];
  if (methodOverride && typeof methodOverride === 'string') {
    req.method = methodOverride.toUpperCase();
  }
  next();
});

// Routes
app.use('/photos', photosRouter);
app.use('/collections', collectionsRouter);

interface HealthResponse {
  status: string;
}

// Minimal health endpoint - returns only healthy/unhealthy status
// Does not expose uptime, timestamps, or detailed DB status to prevent info leakage
app.get('/health', async (_req: Request, res: Response<HealthResponse>) => {
  let isHealthy = false;

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1');
      isHealthy = true;
    }
  } catch {
    // DB query failed - unhealthy
  }

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy'
  });
});

AppDataSource.initialize()
  .then(() => {
    console.log('Database connection established');
    app.listen(PORT, () => {
      console.log(`Photo API server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
