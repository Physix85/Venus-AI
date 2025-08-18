import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import Tesseract from "tesseract.js";

const router = express.Router();

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {}
}

// Multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_\.]/g, "_");
    const name = `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}_${base}${ext}`;
    cb(null, name);
  },
});

const MAX_FILE_SIZE = parseInt(
  process.env.MAX_FILE_SIZE || `${10 * 1024 * 1024}`,
  10
); // 10MB default
const ALLOWED = (
  process.env.ALLOWED_FILE_TYPES ||
  "image/jpeg,image/png,image/gif,application/pdf,text/plain"
).split(",");

function fileFilter(req, file, cb) {
  if (ALLOWED.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Unsupported file type: ${file.mimetype}`));
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

function excerpt(text, max = 2000) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.slice(0, max);
}

async function extractText(filePath, mimetype) {
  try {
    if (mimetype === "application/pdf") {
      // Forward to AI service for PDF extraction to avoid Node DOM dependencies
      try {
        const aiUrl =
          process.env.CHAT_PROCESSOR_URL ||
          process.env.AI_SERVICE_URL ||
          "http://localhost:8001";
        const form = new FormData();
        const data = await fs.readFile(filePath);
        form.append("file", new Blob([data]), path.basename(filePath));
        const res = await fetch(`${aiUrl}/extract/pdf`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const json = await res.json();
          return excerpt(json.text || "");
        }
      } catch {}
      return null;
    }
    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // DOCX via ai-service
      try {
        const aiUrl =
          process.env.CHAT_PROCESSOR_URL ||
          process.env.AI_SERVICE_URL ||
          "http://localhost:8001";
        const form = new FormData();
        const data = await fs.readFile(filePath);
        form.append("file", new Blob([data]), path.basename(filePath));
        const res = await fetch(`${aiUrl}/extract/docx`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const json = await res.json();
          return excerpt(json.text || "");
        }
      } catch {}
      return null;
    }

    if (mimetype === "text/plain") {
      const txt = await fs.readFile(filePath, "utf8");
      return excerpt(txt);
    }
    if (
      mimetype === "text/csv" ||
      mimetype === "application/csv" ||
      mimetype === "application/vnd.ms-excel"
    ) {
      // CSV via ai-service
      try {
        const aiUrl =
          process.env.CHAT_PROCESSOR_URL ||
          process.env.AI_SERVICE_URL ||
          "http://localhost:8001";
        const form = new FormData();
        const data = await fs.readFile(filePath);
        form.append("file", new Blob([data]), path.basename(filePath));
        const res = await fetch(`${aiUrl}/extract/csv`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const json = await res.json();
          return excerpt(json.text || "");
        }
      } catch {}
      return null;
    }

    if (mimetype.startsWith("image/")) {
      if (String(process.env.ENABLE_OCR || "false").toLowerCase() === "true") {
        try {
          const result = await Tesseract.recognize(filePath, "eng");
          return excerpt(result.data?.text || "");
        } catch (e) {
          return null; // OCR is best-effort
        }
      }
      return null; // No OCR
    }
    return null;
  } catch (e) {
    return null;
  }
}

router.post("/", upload.array("files", 6), async (req, res) => {
  try {
    const attachments = [];
    for (const f of req.files || []) {
      const url = `/uploads/${path.basename(f.path)}`;
      const textExcerpt = await extractText(f.path, f.mimetype);
      attachments.push({
        filename: f.originalname,
        savedAs: path.basename(f.path),
        mimeType: f.mimetype,
        size: f.size,
        url,
        textExcerpt,
      });
    }
    res.json({ attachments });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(400).json({ error: err.message || "Upload failed" });
  }
});

export default router;
