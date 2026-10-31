const express = require('express');
const https = require('https');

const router = express.Router();

const RESOURCE_URL =
  'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

function requestMandiData(params) {
  return new Promise((resolve, reject) => {
    const url = new URL(RESOURCE_URL);

    url.searchParams.set('api-key', process.env.DATA_GOV_IN_API_KEY);
    url.searchParams.set('format', 'json');

    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    https.get(url, { timeout: 15000 }, response => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);

      response.on('end', () => {
        let data;

        try {
          data = JSON.parse(body);
        } catch {
          return reject(new Error('Government mandi API returned invalid JSON.'));
        }

        if (response.statusCode !== 200) {
          const error = new Error(
            data.message || data.error || `Government API returned HTTP ${response.statusCode}`
          );
          error.status = response.statusCode === 403 ? 502 : 502;
          return reject(error);
        }

        resolve(data);
      });
    }).on('timeout', function () {
      this.destroy(new Error('Government mandi API timed out.'));
    }).on('error', reject);
  });
}

router.get('/', async (req, res) => {
  if (!process.env.DATA_GOV_IN_API_KEY) {
    return res.status(503).json({
      status: 'error',
      message: 'Government mandi API key is not configured.'
    });
  }

  const allowedFilters = {
    'filters[state.keyword]': 'state',
    'filters[district]': 'district',
    'filters[market]': 'market',
    'filters[commodity]': 'commodity',
    'filters[variety]': 'variety',
    'filters[grade]': 'grade'
  };

  const params = {};

  for (const [apiParam, queryParam] of Object.entries(allowedFilters)) {
    const value = String(req.query[queryParam] || '').trim();

    if (value.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: `The ${queryParam} filter is too long.`
      });
    }

    if (value) params[apiParam] = value;
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const requestedOffset = Number.parseInt(req.query.offset, 10);

  params.limit = String(
    Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20
  );

  params.offset = String(
    Number.isInteger(requestedOffset)
      ? Math.min(Math.max(requestedOffset, 0), 1000000)
      : 0
  );

  try {
    const data = await requestMandiData(params);
    const records = Array.isArray(data.records) ? data.records : [];

    res.json({
      status: 'success',
      source: 'data.gov.in — Government of India',
      total: Number(data.total) || 0,
      limit: Number(params.limit),
      offset: Number(params.offset),
      records
    });
  } catch (error) {
    console.error('Nationwide mandi API error:', error.message);

    res.status(502).json({
      status: 'error',
      message: 'Could not retrieve nationwide mandi prices. Please try again later.'
    });
  }
});

module.exports = router;
