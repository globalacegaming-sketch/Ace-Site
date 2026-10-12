import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { buildSafeUploadFilename, isAllowedUpload } from './uploadSafety';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'image/webp'
];

const chatUploadsDir = path.resolve(__dirname, '../../uploads/chat');
fs.mkdirSync(chatUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadsDir),
  filename: (_req, file, cb) => {
    cb(null, buildSafeUploadFilename(file.originalname, file.mimetype));
  }
});

export const chatAttachmentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file.mimetype, ALLOWED_MIME_TYPES)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

export const getChatAttachmentUrl = (filename: string): string =>
  `/uploads/chat/${filename}`;

