/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — System Constants
   ═══════════════════════════════════════════════════ */

const KV_CONSTANTS = {

  /* App Identity */
  APP_NAME:    'KRUSHIVIKAS',
  APP_VERSION: '2.0.1',

  /* AI Model */
  AI_MODEL:    'claude-sonnet-4-20250514',
  AI_TOKENS:   1000,

  /* Storage */
  STORAGE_KEY: 'kv_diagnostic_archive',
  ARCHIVE_LIMIT: 50,

  /* Live sensor thresholds */
  SENSOR: {
    SOIL_DRY_THRESHOLD: 2500,
    RAIN_THRESHOLD:     3000,
    LDR_LOW_THRESHOLD:  1800,
  },

  /* Health Thresholds */
  HEALTH: {
    EXCELLENT:  80,
    GOOD:       60,
    MODERATE:   40,
    DEGRADED:   20,
  },

  /* Soil Type Keys */
  SOIL_TYPES: {
    LOAMY:     'loamy_agricultural',
    CLAY:      'clay_dominant',
    SANDY:     'sandy_porous',
    LATERITIC: 'lateritic_red',
    ALLUVIAL:  'alluvial_silty',
    MIXED:     'mixed_transitional',
  },

  /* Risk Severity */
  SEVERITY: {
    HIGH:     'high',
    MODERATE: 'moderate',
    LOW:      'low',
  },

  /* Seasons */
  SEASONS: ['kharif', 'rabi', 'summer', 'all'],

  /* Analysis Steps (for loader log) */
  ANALYSIS_STEPS: [
    'Parsing field observations...',
    'Loading sensor telemetry...',
    'Running soil classification model...',
    'Computing health indicators...',
    'Evaluating risk vectors...',
    'Generating crop suitability matrix...',
    'Consulting AI agronomy engine...',
    'Building recovery timeline...',
    'Compiling diagnostic report...',
  ],

  /* Loader Step Delay (ms) */
  STEP_DELAY: 280,

  /* API Endpoint */
  API_URL: 'https://api.anthropic.com/v1/messages',

};
