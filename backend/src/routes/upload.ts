import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

// File filter for videos
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, WebM, OGG videos and JPEG, PNG, WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  },
});

// List uploaded files
router.get(
  '/files',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const files = fs.readdirSync('uploads/').filter(file => 
        ['.mp4', '.webm', '.ogg'].includes(path.extname(file).toLowerCase())
      );
      res.json({ files: files.map(f => `/uploads/${f}`) });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

// Stream local file from path
router.get(
  '/local',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const filePath = req.query.path as string;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    try {
      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        if (start >= fileSize) {
          res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
          return;
        }

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      console.error('Streaming error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Upload endpoint
router.post(
  '/',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }
);

export default router;
