import multer from 'multer';
import { config } from '../../config.ts';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});
