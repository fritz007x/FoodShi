import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { verifyJWT } from '../middleware/auth';

const router = Router();
router.use(verifyJWT);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

/**
 * POST /api/uploads/image
 * Accepts a single image file (field name: "image"), uploads to Cloudinary,
 * and returns the public URL.
 */
router.post('/image', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'foodshi' }, (err, result) => {
          if (err || !result) reject(err ?? new Error('Upload failed'));
          else resolve(result);
        })
        .end(req.file!.buffer);
    });

    res.json({ url: result.secure_url });
  } catch {
    res.status(502).json({ error: 'Image upload failed' });
  }
});

export default router;
