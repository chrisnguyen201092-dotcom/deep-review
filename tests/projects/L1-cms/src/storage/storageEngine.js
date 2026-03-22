const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/var/cms/uploads';
const S3_BUCKET = process.env.S3_BUCKET || '';

class StorageEngine {
  constructor() {
    this.type = STORAGE_TYPE;
    if (this.type === 's3') {
      this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    }
  }

  async store(tempPath, originalName, mimetype) {
    if (this.type === 'local') {
      return this._storeLocal(tempPath, originalName);
    } else if (this.type === 's3') {
      return this._storeS3(tempPath, originalName, mimetype);
    }
    throw new Error(`Unknown storage type: ${this.type}`);
  }

  async _storeLocal(tempPath, originalName) {
    const ext = path.extname(originalName);
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const destDir = path.join(LOCAL_STORAGE_DIR, datePath);
    fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, originalName);
    fs.copyFileSync(tempPath, destPath);
    return `/uploads/${datePath}/${originalName}`;
  }

  async _storeS3(tempPath, originalName, mimetype) {
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const key = `uploads/${datePath}/${originalName}`;
    const body = fs.readFileSync(tempPath);
    await this.s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimetype,
    }));
    return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  async remove(storedPath) {
    if (this.type === 'local') {
      const fullPath = path.join(LOCAL_STORAGE_DIR, storedPath.replace('/uploads/', ''));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else if (this.type === 's3') {
      const key = storedPath.replace(`https://${S3_BUCKET}.s3.amazonaws.com/`, '');
      await this.s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    }
  }
}

module.exports = StorageEngine;
