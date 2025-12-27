import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Collection } from '../entities/Collection';
import { Photo } from '../entities/Photo';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();
const collectionRepository = AppDataSource.getRepository(Collection);
const photoRepository = AppDataSource.getRepository(Photo);

// GET /collections - List all collections with photo counts
router.get('/', async (req: Request, res: Response) => {
  try {
    const collections = await collectionRepository
      .createQueryBuilder('collection')
      .loadRelationCountAndMap('collection.photoCount', 'collection.photos')
      .orderBy('collection.name', 'ASC')
      .getMany();
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// GET /collections/:id - Get single collection with photos
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const collection = await collectionRepository.findOne({
      where: { id: req.params.id },
      relations: ['photos', 'photos.meta']
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// POST /collections - Create a new collection
router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const collection = collectionRepository.create({ name });
    const savedCollection = await collectionRepository.save(collection);
    res.status(201).json(savedCollection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// POST /collections/get-or-create - Get existing or create new collection by name
router.post('/get-or-create', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Try to find existing collection
    let collection = await collectionRepository.findOne({ where: { name } });

    // Create if doesn't exist
    if (!collection) {
      collection = collectionRepository.create({ name });
      collection = await collectionRepository.save(collection);
    }

    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get or create collection' });
  }
});

// DELETE /collections/cleanup-empty - Remove all empty collections
// Must be defined before /:id to avoid being matched as an ID
router.delete('/cleanup-empty', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const collections = await collectionRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.photos', 'photo')
      .getMany();

    const emptyCollections = collections.filter(c => !c.photos || c.photos.length === 0);

    for (const collection of emptyCollections) {
      await collectionRepository.delete(collection.id);
    }

    res.json({
      message: `Deleted ${emptyCollections.length} empty collections`,
      deleted: emptyCollections.map(c => c.name)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cleanup empty collections' });
  }
});

// DELETE /collections/:id - Delete collection (only if empty)
router.delete('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const collection = await collectionRepository.findOne({
      where: { id: req.params.id },
      relations: ['photos']
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (collection.photos && collection.photos.length > 0) {
      res.status(400).json({ error: 'Cannot delete collection with photos' });
      return;
    }

    await collectionRepository.delete(collection.id);
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

export default router;
