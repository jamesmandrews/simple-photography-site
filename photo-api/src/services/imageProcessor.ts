import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';

export interface ImageSizeConfig {
  name: string;
  height?: number;
  width?: number;
  longEdge?: number;
  quality: number;
}

const IMAGE_SIZES: ImageSizeConfig[] = [
  { name: 'thumb', height: 300, quality: 80 },
  { name: 'featured', height: 600, quality: 85 },
  { name: 'display', longEdge: 1600, quality: 85 },
];

// Base paths
const UPLOADS_BASE = path.join(__dirname, '../../uploads');
const COLLECTIONS_BASE = path.join(__dirname, '../../collections');
const TEMP_DIR = path.join(UPLOADS_BASE, 'temp');

// Ensure directories exist
export async function ensureDirectories(): Promise<void> {
  await fsp.mkdir(TEMP_DIR, { recursive: true });
  await fsp.mkdir(COLLECTIONS_BASE, { recursive: true });
}

/**
 * Get the image directory for a photo
 */
export function getPhotoDir(collectionId: string | null, photoId: string): string {
  const collectionDir = collectionId || '_uncategorized';
  return path.join(COLLECTIONS_BASE, collectionDir, photoId);
}

/**
 * Get the oriented dimensions of an image (respects EXIF orientation)
 */
export async function getOrientedDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imagePath).metadata();
  const rawWidth = metadata.width || 0;
  const rawHeight = metadata.height || 0;
  const orientation = metadata.orientation || 1;

  // Orientations 5-8 are rotated 90 degrees, so width/height are swapped
  if (orientation >= 5 && orientation <= 8) {
    return { width: rawHeight, height: rawWidth };
  }
  return { width: rawWidth, height: rawHeight };
}

/**
 * Process an uploaded image and generate all size variants
 * @param tempPath - Path to temp uploaded file
 * @param collectionId - Collection ID (null for uncategorized)
 * @param photoId - Photo UUID
 * @returns The oriented dimensions of the image
 */
export async function processImage(
  tempPath: string,
  collectionId: string | null,
  photoId: string
): Promise<{ width: number; height: number }> {
  const outputDir = getPhotoDir(collectionId, photoId);

  // Ensure output directory exists
  await fsp.mkdir(outputDir, { recursive: true });

  // Move original to the output directory (copy+delete for cross-volume support)
  const originalFilename = 'original.jpg';
  const originalDest = path.join(outputDir, originalFilename);
  await fsp.copyFile(tempPath, originalDest);
  await fsp.unlink(tempPath);

  // Get original image metadata (accounting for EXIF orientation)
  const { width: originalWidth, height: originalHeight } = await getOrientedDimensions(originalDest);

  // Generate each size variant
  for (const size of IMAGE_SIZES) {
    const outputPath = path.join(outputDir, `${size.name}.webp`);

    let resizeOptions: sharp.ResizeOptions = {};

    if (size.height) {
      // Resize by height, preserve aspect ratio
      resizeOptions = { height: size.height, withoutEnlargement: true };
    } else if (size.width) {
      // Resize by width, preserve aspect ratio
      resizeOptions = { width: size.width, withoutEnlargement: true };
    } else if (size.longEdge) {
      // Resize to fit within long edge
      if (originalWidth >= originalHeight) {
        resizeOptions = { width: size.longEdge, withoutEnlargement: true };
      } else {
        resizeOptions = { height: size.longEdge, withoutEnlargement: true };
      }
    }

    await sharp(originalDest)
      .rotate() // Auto-orient based on EXIF
      .resize(resizeOptions)
      .webp({ quality: size.quality })
      .toFile(outputPath);
  }

  return { width: originalWidth, height: originalHeight };
}

/**
 * Process image in background (fire and forget)
 * Logs errors but doesn't throw
 */
export function processImageAsync(
  tempPath: string,
  collectionId: string | null,
  photoId: string
): void {
  processImage(tempPath, collectionId, photoId).catch((error) => {
    console.error('Background image processing failed:', error);
  });
}

/**
 * Delete all image variants for a photo
 */
export async function deleteImageVariants(collectionId: string | null, photoId: string): Promise<void> {
  const imageDir = getPhotoDir(collectionId, photoId);
  await fsp.rm(imageDir, { recursive: true, force: true });
}

/**
 * Move photo images when collection changes
 */
export async function movePhotoToCollection(
  oldCollectionId: string | null,
  newCollectionId: string | null,
  photoId: string
): Promise<void> {
  const oldDir = getPhotoDir(oldCollectionId, photoId);
  const newDir = getPhotoDir(newCollectionId, photoId);

  if (oldDir === newDir) return;

  try {
    await fsp.access(oldDir);
    // Ensure new collection directory exists
    const newCollectionDir = path.dirname(newDir);
    await fsp.mkdir(newCollectionDir, { recursive: true });
    await fsp.rename(oldDir, newDir);
  } catch {
    // Old directory doesn't exist, nothing to move
  }
}

/**
 * Get path to a specific image size
 */
export async function getImagePath(collectionId: string | null, photoId: string, size: string): Promise<string | null> {
  const imageDir = getPhotoDir(collectionId, photoId);

  const fileExists = async (filePath: string): Promise<boolean> => {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  if (size === 'original') {
    const originalPath = path.join(imageDir, 'original.jpg');
    return await fileExists(originalPath) ? originalPath : null;
  }

  const webpPath = path.join(imageDir, `${size}.webp`);
  if (await fileExists(webpPath)) {
    return webpPath;
  }

  // Fall back to original if variant doesn't exist yet
  const originalPath = path.join(imageDir, 'original.jpg');
  return await fileExists(originalPath) ? originalPath : null;
}

// Initialize directories at module load (sync) - only runs once at startup
// Runtime file operations are async to avoid blocking the event loop
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(COLLECTIONS_BASE, { recursive: true });

/**
 * Get the temp directory path for multer
 */
export function getTempDir(): string {
  return TEMP_DIR;
}
