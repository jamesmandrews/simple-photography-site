import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppDataSource } from '../data-source';
import { Photo } from '../entities/Photo';
import { PhotoMeta } from '../entities/PhotoMeta';
import { Collection } from '../entities/Collection';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import {
  getTempDir,
  processImage,
  deleteImageVariants,
  movePhotoToCollection,
  getImagePath
} from '../services/imageProcessor';

const router = Router();
const photoRepository = AppDataSource.getRepository(Photo);
const metaRepository = AppDataSource.getRepository(PhotoMeta);
const collectionRepository = AppDataSource.getRepository(Collection);

// Configure multer for file uploads - save to temp directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getTempDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uuid = crypto.randomUUID();
    cb(null, `${uuid}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Helper to build image URLs for a photo
function buildImageUrls(photoId: string): Record<string, string> {
  return {
    display: `/photos/${photoId}/display`,
    featured: `/photos/${photoId}/featured`,
    thumb: `/photos/${photoId}/thumb`
  };
}

// GET /photos - List all photos with collection and metadata
router.get('/', async (req: Request, res: Response) => {
  try {
    const photos = await photoRepository.find({
      relations: ['collection', 'meta'],
      order: { createdAt: 'DESC' }
    });

    // Transform to API response format
    const response = photos.map(photo => ({
      id: photo.id,
      featured: photo.featured,
      collectionId: photo.collection?.id,
      collectionName: photo.collection?.name,
      title: photo.title,
      description: photo.description,
      images: buildImageUrls(photo.id),
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
      meta: photo.meta.reduce((acc, m) => {
        acc[m.key] = m.value;
        return acc;
      }, {} as Record<string, string>),
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /photos/:id/:size - Serve image file
router.get('/:id/:size', async (req: Request, res: Response) => {
  try {
    const { id, size } = req.params;
    const validSizes = ['display', 'featured', 'thumb'];

    if (!validSizes.includes(size)) {
      res.status(400).json({ error: 'Invalid image size' });
      return;
    }

    const photo = await photoRepository.findOne({
      where: { id },
      relations: ['collection']
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const collectionId = photo.collection?.id || null;
    const imagePath = await getImagePath(collectionId, photo.id, size);

    if (!imagePath) {
      res.status(404).json({ error: 'Image file not found' });
      return;
    }

    // Set appropriate content type
    const contentType = imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// GET /photos/:id - Get single photo with metadata
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const photo = await photoRepository.findOne({
      where: { id: req.params.id },
      relations: ['collection', 'meta']
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const response = {
      id: photo.id,
      featured: photo.featured,
      collectionId: photo.collection?.id,
      collectionName: photo.collection?.name,
      title: photo.title,
      description: photo.description,
      images: buildImageUrls(photo.id),
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
      meta: photo.meta.reduce((acc, m) => {
        acc[m.key] = m.value;
        return acc;
      }, {} as Record<string, string>),
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Custom error class for validation errors with status codes
class UploadError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'UploadError';
  }
}

// POST /photos - Upload a new photo
router.post('/', apiKeyAuth, upload.single('image'), async (req: Request, res: Response) => {
  // Helper to clean up temp file
  const cleanupFile = () => {
    if (req.file) {
      const filePath = path.join(getTempDir(), req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  };

  try {
    if (!req.file) {
      throw new UploadError('Image file is required');
    }

    const { title, description, alt, width, height, featured, collectionId, meta } = req.body;

    const photoTitle = title || '';

    // Find collection if provided
    let collection: Collection | null = null;
    if (collectionId) {
      collection = await collectionRepository.findOne({ where: { id: collectionId } });
      if (!collection) {
        throw new UploadError('Collection not found');
      }
    }

    // Create photo record (src stores the photo ID for path resolution)
    const photo = photoRepository.create({
      title: photoTitle,
      description: description || '',
      src: '', // Will be set to photo ID after save
      alt: alt || photoTitle,
      width: parseInt(width) || 0,
      height: parseInt(height) || 0,
      featured: featured === 'true' || featured === true,
      collection: collection || undefined
    });

    const savedPhoto = await photoRepository.save(photo);

    // Update src to the photo ID (used for path resolution)
    savedPhoto.src = savedPhoto.id;
    await photoRepository.save(savedPhoto);

    // Save metadata if provided
    if (meta) {
      let metaObj: Record<string, unknown>;
      try {
        metaObj = typeof meta === 'string' ? JSON.parse(meta) : meta;
      } catch {
        throw new UploadError('Invalid JSON in meta field');
      }

      if (typeof metaObj !== 'object' || metaObj === null || Array.isArray(metaObj)) {
        throw new UploadError('meta must be a JSON object');
      }

      const metaEntries = Object.entries(metaObj);

      for (const [key, value] of metaEntries) {
        const photoMeta = metaRepository.create({
          photo: savedPhoto,
          key,
          value: String(value)
        });
        await metaRepository.save(photoMeta);
      }
    }

    // Process image and get correct dimensions (accounting for EXIF orientation)
    const tempPath = path.join(getTempDir(), req.file.filename);
    const dimensions = await processImage(tempPath, collection?.id || null, savedPhoto.id);

    // Update photo with correct dimensions from the image
    savedPhoto.width = dimensions.width;
    savedPhoto.height = dimensions.height;
    await photoRepository.save(savedPhoto);

    // Reload with relations
    const result = await photoRepository.findOne({
      where: { id: savedPhoto.id },
      relations: ['collection', 'meta']
    });

    // Build response with image URLs
    const response = {
      id: result!.id,
      featured: result!.featured,
      collectionId: result!.collection?.id,
      collectionName: result!.collection?.name,
      title: result!.title,
      description: result!.description,
      images: buildImageUrls(result!.id),
      alt: result!.alt,
      width: result!.width,
      height: result!.height,
      meta: result!.meta.reduce((acc, m) => {
        acc[m.key] = m.value;
        return acc;
      }, {} as Record<string, string>),
      createdAt: result!.createdAt,
      updatedAt: result!.updatedAt
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Upload error:', error);
    cleanupFile();

    if (error instanceof UploadError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
});

// PUT /photos/:id - Update photo metadata
router.put('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const photo = await photoRepository.findOne({
      where: { id: req.params.id },
      relations: ['meta', 'collection']
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const { title, description, alt, featured, collectionId, meta } = req.body;
    const oldCollectionId = photo.collection?.id || null;

    // Update basic fields
    if (title !== undefined) photo.title = title;
    if (description !== undefined) photo.description = description;
    if (alt !== undefined) photo.alt = alt;
    if (featured !== undefined) photo.featured = featured === 'true' || featured === true;

    // Update collection
    let newCollectionId = oldCollectionId;
    if (collectionId !== undefined) {
      if (collectionId === null) {
        photo.collection = undefined as any;
        newCollectionId = null;
      } else {
        const collection = await collectionRepository.findOne({ where: { id: collectionId } });
        if (!collection) {
          res.status(404).json({ error: 'Collection not found' });
          return;
        }
        photo.collection = collection;
        newCollectionId = collection.id;
      }
    }

    await photoRepository.save(photo);

    // Move image files if collection changed
    if (oldCollectionId !== newCollectionId) {
      await movePhotoToCollection(oldCollectionId, newCollectionId, photo.id);
    }

    // Update metadata if provided
    if (meta) {
      let metaObj: Record<string, unknown>;
      try {
        metaObj = typeof meta === 'string' ? JSON.parse(meta) : meta;
      } catch {
        res.status(400).json({ error: 'Invalid JSON in meta field' });
        return;
      }

      if (typeof metaObj !== 'object' || metaObj === null || Array.isArray(metaObj)) {
        res.status(400).json({ error: 'meta must be a JSON object' });
        return;
      }

      // Delete existing meta
      await metaRepository.delete({ photo: { id: photo.id } });

      // Add new meta
      for (const [key, value] of Object.entries(metaObj)) {
        const photoMeta = metaRepository.create({
          photo,
          key,
          value: String(value)
        });
        await metaRepository.save(photoMeta);
      }
    }

    // Reload with relations
    const result = await photoRepository.findOne({
      where: { id: photo.id },
      relations: ['collection', 'meta']
    });

    // Build response with image URLs
    const response = {
      id: result!.id,
      featured: result!.featured,
      collectionId: result!.collection?.id,
      collectionName: result!.collection?.name,
      title: result!.title,
      description: result!.description,
      images: buildImageUrls(result!.id),
      alt: result!.alt,
      width: result!.width,
      height: result!.height,
      meta: result!.meta.reduce((acc, m) => {
        acc[m.key] = m.value;
        return acc;
      }, {} as Record<string, string>),
      createdAt: result!.createdAt,
      updatedAt: result!.updatedAt
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE /photos/:id - Delete photo and all image files
router.delete('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const photo = await photoRepository.findOne({
      where: { id: req.params.id },
      relations: ['collection']
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const collectionId = photo.collection?.id || null;

    // Delete all image variants
    await deleteImageVariants(collectionId, photo.id);

    // Delete metadata first (foreign key constraint)
    await metaRepository.delete({ photo: { id: photo.id } });

    // Delete photo record
    await photoRepository.delete(photo.id);

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
