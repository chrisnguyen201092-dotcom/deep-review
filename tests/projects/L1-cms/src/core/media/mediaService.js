const db = require('../../storage/database');
const StorageEngine = require('../../storage/storageEngine');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const storageEngine = new StorageEngine();

class MediaService {
  async processUpload(file, userId, alt) {
    // Generate hash for deduplication
    const fileBuffer = fs.readFileSync(file.path);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate
    const existing = await db.query('SELECT * FROM media WHERE hash = ?', [hash]);
    if (existing.length > 0) {
      fs.unlinkSync(file.path); // Clean up duplicate upload
      return existing[0];
    }

    // Store via storage engine (local or S3)
    const storedPath = await storageEngine.store(file.path, file.originalname, file.mimetype);

    // Save metadata
    const result = await db.query(
      'INSERT INTO media (filename, original_name, mimetype, size, hash, path, alt, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [file.filename, file.originalname, file.mimetype, file.size, hash, storedPath, alt || '', userId]
    );

    fs.unlinkSync(file.path); // Clean up temp file
    return { id: result.insertId, filename: file.filename, path: storedPath, mimetype: file.mimetype, size: file.size };
  }

  async list({ type, page, limit }) {
    let where = '';
    const params = [];
    if (type) { where = 'WHERE mimetype LIKE ?'; params.push(`${type}%`); }
    const [items, count] = await Promise.all([
      db.query(`SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]),
      db.query(`SELECT COUNT(*) as total FROM media ${where}`, params),
    ]);
    return { data: items, pagination: { page, limit, total: count[0].total } };
  }

  async getById(id) {
    const rows = await db.query('SELECT * FROM media WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async delete(id) {
    const media = await this.getById(id);
    if (media) {
      await storageEngine.remove(media.path);
      await db.query('DELETE FROM media WHERE id = ?', [id]);
    }
  }
}

module.exports = MediaService;
