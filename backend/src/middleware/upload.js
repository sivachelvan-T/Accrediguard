const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { AppError } = require('./errorHandler');

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const MAX_FILES = Number(process.env.MAX_FILES_PER_REQUEST) || 5;

// Server-generated filenames only — the original filename is never used
// as a filesystem path, which rules out path traversal / null-byte tricks.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuid()}.pdf`),
});

const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

function fileFilter(req, file, cb) {
  const extOk = path.extname(file.originalname).toLowerCase() === '.pdf';
  const mimeOk = file.mimetype === 'application/pdf';
  if (!extOk || !mimeOk) {
    return cb(new AppError('Only PDF files are accepted.', 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

// Extension/MIME can be spoofed by the client, so after multer writes the
// file we verify the actual magic bytes match a real PDF header before
// trusting it any further in the pipeline.
function verifyMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  return buf.equals(PDF_MAGIC_BYTES);
}

module.exports = { upload, verifyMagicBytes, UPLOAD_DIR };
