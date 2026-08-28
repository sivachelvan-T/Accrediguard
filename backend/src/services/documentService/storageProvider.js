const fs = require('fs');
const crypto = require('crypto');

// StorageService abstraction: LocalStorageProvider is the only
// implementation shipped (Render/local disk), but routes never touch
// fs directly — this interface is where an S3/object-storage provider
// would be plugged in later without touching calling code.
class LocalStorageProvider {
  hashFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  deleteFile(filePath) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  readFile(filePath) {
    return fs.readFileSync(filePath);
  }
}

module.exports = { storageProvider: new LocalStorageProvider() };
