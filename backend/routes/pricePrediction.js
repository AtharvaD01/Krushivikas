const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PRICE_DIR = path.join(PROJECT_ROOT, 'price-prediction');
const PYTHON = path.join(PRICE_DIR, '.venv', 'bin', 'python');
const PREDICT_SCRIPT = path.join(PRICE_DIR, 'predict.py');
const DATA_FILE = path.join(PRICE_DIR, 'maharashtra_banana_prices.csv');
const EVALUATION_FILE = path.join(PRICE_DIR, 'evaluation.json');


router.get('/history', (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Historical banana price data is unavailable.'
            });
        }

        const lines = fs.readFileSync(DATA_FILE, 'utf8').trim().split(/\r?\n/);
        if (lines.length < 2) {
            return res.json({ status: 'success', data: [], observations: 0 });
        }

        const headers = lines.shift().split(',').map(v => v.trim());
        const index = Object.fromEntries(headers.map((h, i) => [h, i]));
        const data = lines.map(line => {
            const cells = line.split(',');
            return {
                date: cells[index.date],
                min_price: Number(cells[index.min_price]),
                max_price: Number(cells[index.max_price]),
                modal_price: Number(cells[index.modal_price])
            };
        }).filter(r =>
            /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') &&
            Number.isFinite(r.modal_price) && r.modal_price > 0
        ).sort((a, b) => a.date.localeCompare(b.date));

        res.set('Cache-Control', 'public, max-age=300');
        return res.json({
            status: 'success',
            source: 'CEDA Agmarknet API',
            region: 'Maharashtra',
            commodity: 'Banana',
            unit: 'Source price units; verify before conversion',
            observations: data.length,
            date_start: data[0]?.date || null,
            date_end: data[data.length - 1]?.date || null,
            data,
            warning: 'Historical observations only. Missing dates are not interpolated.'
        });
    } catch (error) {
        console.error('Banana price history error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Could not load historical banana prices.'
        });
    }
});

router.get('/', async (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE) || !fs.existsSync(PREDICT_SCRIPT)) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Banana price prediction data or model is not available.'
            });
        }

        const output = await new Promise((resolve, reject) => {
            const child = spawn(PYTHON, [PREDICT_SCRIPT], {
                cwd: PRICE_DIR,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 15000
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', chunk => stdout += chunk);
            child.stderr.on('data', chunk => stderr += chunk);

            child.on('error', reject);
            child.on('close', code => {
                if (code !== 0) {
                    return reject(new Error(stderr || `Python exited with code ${code}`));
                }
                resolve(stdout);
            });
        });

        const forecast = JSON.parse(output);
        const evaluation = fs.existsSync(EVALUATION_FILE)
            ? JSON.parse(fs.readFileSync(EVALUATION_FILE, 'utf8'))
            : null;

        const latestDate = new Date(`${forecast.last_observed_date}T00:00:00Z`);
        const ageDays = Math.floor(
            (Date.now() - latestDate.getTime()) / 86400000
        );
        const stale = !Number.isFinite(ageDays) || ageDays > 7;

        return res.json({
            status: 'success',
            data: {
                ...forecast,
                data_age_days: ageDays,
                stale,
                forecast_is_current: !stale,
                warning: stale
                    ? 'Historical data is stale. This estimate must not be treated as a current market forecast.'
                    : forecast.warning,
                evaluation
            }
        });
    } catch (error) {
        console.error('Banana price prediction error:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'Banana price prediction service failed.'
        });
    }
});

module.exports = router;
