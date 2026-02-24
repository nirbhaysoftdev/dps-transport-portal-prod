import multer from "multer";

const storage = multer.memoryStorage();

export const csvUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith(".csv")) {
      cb(new Error("Only CSV files allowed"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
