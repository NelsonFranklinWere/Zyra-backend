const express = require('express');
const multer = require('multer');
const dataController = require('../controllers/dataController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
    }
  }
});

// Data source management
router.get('/sources', dataController.getDataSources);
router.get('/sources/:id', dataController.getDataSourceById);
router.post('/sources/upload', upload.single('file'), dataController.uploadDataSource);
router.delete('/sources/:id', dataController.deleteDataSource);

// Data processing
router.post('/sources/:id/process', dataController.processDataSource);
router.get('/sources/:id/preview', dataController.getDataPreview);
router.get('/sources/:id/schema', dataController.getDataSchema);

// Data analysis
router.post('/analyze', dataController.analyzeData);
router.get('/analysis/:id', dataController.getAnalysisResult);
router.get('/analysis', dataController.getAnalysisHistory);

// Data export
router.get('/sources/:id/export', dataController.exportData);
router.get('/sources/:id/export/:format', dataController.exportDataFormat);

module.exports = router;

