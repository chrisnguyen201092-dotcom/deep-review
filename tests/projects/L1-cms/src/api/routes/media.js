const express = require('express');
const router = express.Router();
const MediaService = require('../../core/media/mediaService');
const { authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const mediaService = new MediaService();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                          'video/mp4', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Upload file
router.post('/upload', authorize('editor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const media = await mediaService.processUpload(req.file, req.user.id, req.body.alt || '');
    res.status(201).json(media);
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List media
router.get('/', async (req, res) => {
  try {
    const { type, page, limit } = req.query;
    const result = await mediaService.list({
      type: type || null,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list media' });
  }
});

// Get single media
router.get('/:id', async (req, res) => {
  try {
    const media = await mediaService.getById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Delete media
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await mediaService.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

module.exports = router;
