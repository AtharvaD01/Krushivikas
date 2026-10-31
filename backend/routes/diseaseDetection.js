const express = require('express');
const multer = require('multer');

const router = express.Router();

const PYTHON_API = 'http://127.0.0.1:8000';
const MAX_SIZE = 10 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
            return callback(new Error('Please upload an image file.'));
        }
        callback(null, true);
    }
});

router.post('/predict', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No image found. Upload an image using the field name "image".'
            });
        }

        const form = new FormData();

        form.append(
            'image',
            new Blob([req.file.buffer], { type: req.file.mimetype }),
            req.file.originalname
        );

        const response = await fetch(`${PYTHON_API}/predict`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(60000)
        });

        const result = await response.json();
        return res.status(response.status).json(result);

    } catch (error) {
        console.error('Disease detection error:', error.message);

        return res.status(502).json({
            status: 'error',
            message: 'Disease detection service is unavailable. Please try again.'
        });
    }
});

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            status: 'error',
            message: 'Image must be smaller than 10 MB.'
        });
    }

    if (error) {
        return res.status(400).json({
            status: 'error',
            message: error.message || 'Invalid image upload.'
        });
    }

    next();
});

module.exports = router;