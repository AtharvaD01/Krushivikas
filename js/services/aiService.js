/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — AI Service
   Claude API integration with structured prompt
   engineering for agronomy intelligence.
   ═══════════════════════════════════════════════════ */

const aiService = {

  model:    KV_CONSTANTS.AI_MODEL,
  endpoint: KV_CONSTANTS.API_URL,

  /* ─────────────────────────────────────────────────
     Build a structured prompt from diagnostic data
  ───────────────────────────────────────────────── */
  buildPrompt(diagnosticData) {
    const { inputs, classification, health, risks, sensors, recommendations } = diagnosticData;

    return `You are an expert agronomist AI for the KRUSHIVIKAS precision agriculture platform.
Analyze the following soil diagnostic data and return a structured JSON response.

FIELD OBSERVATIONS:
- Soil Color: ${inputs.soilColor || 'Not provided'}
- Soil Texture: ${inputs.soilTexture || 'Not provided'}
- Compaction Level: ${inputs.compaction || 'Not provided'}
- Earthworm Activity: ${inputs.earthworms || 'Not provided'}
- Water Infiltration: ${inputs.waterBehavior || 'Not provided'}
- Leaf Color / Crop Health: ${inputs.leafColor || 'Not provided'}
- Organic Inputs Applied: ${inputs.organicInputs || 'Not provided'}
- Previous Crop: ${inputs.previousCrop || 'Not provided'}
- Crop History / Notes: ${inputs.cropHistory || 'Not provided'}
- Irrigation Type: ${inputs.irrigationType || 'Not provided'}

SENSOR READINGS:
- Soil Moisture: ${sensors.soil ?? 'Not available'}
- Rain Sensor: ${sensors.rain ?? 'Not available'}
- Light Intensity: ${sensors.ldr ?? 'Not available'}
- Live Recommendations: ${(recommendations || []).join('; ') || 'None'}

AI ENGINE PRE-ANALYSIS:
- Soil Type Detected: ${classification.soilLabel}
- Health Score: ${health.score}/100
- Health Rating: ${health.rating}
- Risk Level: ${risks.summary.label}

Return ONLY a valid JSON object with EXACTLY this structure (no markdown, no explanation):
{
  "soilSummary": "2-3 sentence expert summary of the soil condition",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "immediateActions": [
    {"priority": 1, "action": "action text", "timeframe": "timeframe string"},
    {"priority": 2, "action": "action text", "timeframe": "timeframe string"},
    {"priority": 3, "action": "action text", "timeframe": "timeframe string"}
  ],
  "recoveryTimeline": [
    {"period": "Week 1-2", "action": "specific action"},
    {"period": "Month 1", "action": "specific action"},
    {"period": "Month 2-3", "action": "specific action"},
    {"period": "Season End", "action": "specific action"}
  ],
  "cropRecommendations": {
    "primary": ["crop1", "crop2", "crop3"],
    "avoid": ["crop to avoid"],
    "rotation": "rotation strategy in one sentence"
  },
  "fertilizerPlan": "specific fertilizer recommendation in 2 sentences",
  "waterManagement": "specific water management advice in 2 sentences",
  "longTermHealth": "long term soil health strategy in 2 sentences"
}`;
  },

  /* ─────────────────────────────────────────────────
     Call Claude API and return structured result
  ───────────────────────────────────────────────── */
  async analyze(diagnosticData) {
    const prompt = this.buildPrompt(diagnosticData);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:      this.model,
          max_tokens: KV_CONSTANTS.AI_TOKENS,
          messages: [
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn('[AI Service] API error:', response.status, errBody);
        return this._fallback(diagnosticData);
      }

      const data = await response.json();

      /* Extract text from content blocks */
      const raw = data.content
        .map(block => block.type === 'text' ? block.text : '')
        .join('');

      /* Parse JSON — strip any accidental markdown fences */
      const clean = raw.replace(/```json|```/g, '').trim();

      try {
        const parsed = JSON.parse(clean);
        return { success: true, data: parsed };
      } catch (parseErr) {
        console.warn('[AI Service] JSON parse failed, using fallback', parseErr);
        return this._fallback(diagnosticData);
      }

    } catch (networkErr) {
      console.warn('[AI Service] Network error, using fallback', networkErr);
      return this._fallback(diagnosticData);
    }
  },

  /* ─────────────────────────────────────────────────
     Rule-based fallback when API is unavailable
  ───────────────────────────────────────────────── */
  _fallback(diagnosticData) {
    const { classification, health, risks, crops, recommendations } = diagnosticData;

    // Ensure we have at least sensor-derived recommendations when manual diagnostics are missing.
    // (ai pipeline already passes sensorStore.getRecommendations(), but keep fallback robust.)


    const healthClass = helpers.healthClass(health.score);
    const soilLabel   = classification.soilLabel || 'Mixed Soil';

    const actions = [
      ...(recommendations || []).map((a, i) => ({

        priority: i + 1,
        action: a,
        timeframe: 'Now',
      })),
      ...(health.restoration || []).map((a, i) => ({
        priority: (recommendations || []).length + i + 1,
        action: a,
        timeframe: i === 0 ? 'Immediately' : i === 1 ? 'Within 2 weeks' : 'This season',
      })),
    ].slice(0, 3);

    if (actions.length < 3) {
      actions.push({
        priority: actions.length + 1,
        action: 'Monitor soil moisture weekly and maintain irrigation schedules',
        timeframe: 'Ongoing',
      });
    }

    return {
      success: true,
      data: {
        soilSummary:
          `Your field shows ${soilLabel.toLowerCase()} characteristics with a health score of ${health.score}/100, rated "${health.rating}". ` +
          `${risks.summary.summary} Targeted management will improve productivity significantly.`,

        keyFindings: [
          `Soil classification: ${soilLabel}`,
          `Health score ${health.score}/100 — ${helpers.healthLabel(health.score)}`,
          risks.risks.length > 0
            ? `${risks.risks.length} risk factor(s) identified: ${risks.risks[0].title}`
            : 'No critical risk factors detected',
          (recommendations || []).join('; ') || 'Live sensor recommendations normal',
        ],

        immediateActions: actions.length > 0 ? actions : [
          { priority: 1, action: 'Apply compost at 5 tonnes/hectare', timeframe: 'This week' },
          { priority: 2, action: 'Test soil pH and apply corrective lime/sulphur', timeframe: 'Within 2 weeks' },
          { priority: 3, action: 'Introduce legume cover crop in rotation', timeframe: 'Next season' },
        ],

        recoveryTimeline: [
          { period: 'Week 1–2',   action: 'Apply organic inputs and deep water irrigation' },
          { period: 'Month 1',    action: 'Monitor crop response and adjust irrigation schedule' },
          { period: 'Month 2–3',  action: 'Apply balanced NPK and micronutrient supplement' },
          { period: 'Season End', action: 'Evaluate health score improvement, plan next rotation' },
        ],

        cropRecommendations: {
          primary:  crops.recommended || classification.recommendedCrops || ['Wheat', 'Maize'],
          avoid:    healthClass === 'critical' ? ['Heavy feeders like cotton', 'High water crops'] : [],
          rotation: 'Rotate with legumes every alternate season to restore nitrogen and organic matter.',
        },

        fertilizerPlan:
          `Apply NPK 10-26-26 at planting to address phosphorus and potassium needs. ` +
          `Top-dress with urea at 30 days after germination based on leaf colour response.`,

        waterManagement:
          `Maintain soil moisture between 40–65% field capacity for optimal root activity. ` +
          `Use drip or sprinkler irrigation to reduce surface evaporation and runoff losses.`,

        longTermHealth:
          `Invest in building organic carbon over 3–5 seasons through compost and green manure. ` +
          `Maintain a minimum 30% crop residue cover to protect soil biology year-round.`,
      },
    };
  },

};
