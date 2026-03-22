#!/usr/bin/env node
/**
 * Ground Truth Encryption Utility
 * Encrypts/decrypts ground truth JSON files using AES-256-GCM
 * 
 * Usage:
 *   node encrypt.js encrypt --key <hex_key>
 *   node encrypt.js decrypt --key <hex_key>
 *   node encrypt.js generate-key
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GROUND_TRUTH_DIR = path.join(__dirname, '..', 'ground-truth');
const ENCRYPTED_DIR = path.join(__dirname, '..', 'ground-truth-encrypted');

function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted,
  };
}

function decrypt(encryptedObj, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(encryptedObj.iv, 'base64');
  const tag = Buffer.from(encryptedObj.tag, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedObj.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptAllFiles(keyHex) {
  if (!fs.existsSync(ENCRYPTED_DIR)) {
    fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
  }

  const files = fs.readdirSync(GROUND_TRUTH_DIR).filter(f => f.endsWith('.json'));
  console.log(`Encrypting ${files.length} ground truth files...`);

  for (const file of files) {
    const plaintext = fs.readFileSync(path.join(GROUND_TRUTH_DIR, file), 'utf8');
    const encrypted = encrypt(plaintext, keyHex);
    const outPath = path.join(ENCRYPTED_DIR, file.replace('.json', '.enc'));
    fs.writeFileSync(outPath, JSON.stringify(encrypted, null, 2));
    console.log(`  ✓ ${file} → ${file.replace('.json', '.enc')}`);
  }

  console.log(`\nEncrypted files saved to: ${ENCRYPTED_DIR}`);
  console.log('You can now safely delete the plaintext ground-truth/ directory.');
}

function decryptAllFiles(keyHex) {
  if (!fs.existsSync(ENCRYPTED_DIR)) {
    console.error('No encrypted files found.');
    process.exit(1);
  }

  const files = fs.readdirSync(ENCRYPTED_DIR).filter(f => f.endsWith('.enc'));
  const results = {};

  for (const file of files) {
    const encryptedObj = JSON.parse(fs.readFileSync(path.join(ENCRYPTED_DIR, file), 'utf8'));
    try {
      const plaintext = decrypt(encryptedObj, keyHex);
      const projectName = file.replace('.enc', '');
      results[projectName] = JSON.parse(plaintext);
      console.log(`  ✓ ${file} decrypted`);
    } catch (err) {
      console.error(`  ✗ ${file}: decryption failed (wrong key?)`);
    }
  }

  return results;
}

function decryptSingleFile(filePath, keyHex) {
  const encryptedObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const plaintext = decrypt(encryptedObj, keyHex);
  return JSON.parse(plaintext);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'generate-key') {
  const key = generateKey();
  console.log(`Generated AES-256 key: ${key}`);
  console.log('Store this key securely — it is required to decrypt ground truth.');
} else if (command === 'encrypt') {
  const keyIdx = args.indexOf('--key');
  const key = keyIdx !== -1 ? args[keyIdx + 1] : process.env.GROUND_TRUTH_KEY;
  if (!key || key.length !== 64) {
    console.error('Error: 64-character hex key required. Use --key <hex> or set GROUND_TRUTH_KEY env var.');
    process.exit(1);
  }
  encryptAllFiles(key);
} else if (command === 'decrypt') {
  const keyIdx = args.indexOf('--key');
  const key = keyIdx !== -1 ? args[keyIdx + 1] : process.env.GROUND_TRUTH_KEY;
  if (!key || key.length !== 64) {
    console.error('Error: 64-character hex key required.');
    process.exit(1);
  }
  const results = decryptAllFiles(key);
  console.log(`\nDecrypted ${Object.keys(results).length} files.`);
} else {
  console.log('Usage:');
  console.log('  node encrypt.js generate-key');
  console.log('  node encrypt.js encrypt --key <64-char-hex-key>');
  console.log('  node encrypt.js decrypt --key <64-char-hex-key>');
}

module.exports = { encrypt, decrypt, decryptSingleFile, generateKey, decryptAllFiles };
