- [x] Inspect sensorWidget/dashboard/reportPanel usage of old schema keys
- [x] Update sensorWidget.js to display only Soil/Rain/Light cards and bind to sensorStore live values
- [x] Update soilEngine.js to consume sensorStore.soil/rain/ldr for live sensor influence, while keeping manual input fallback
- [x] Update recommendationEngine.js thresholds/logic to match sensorStore fields (soil/rain/ldr)
- [x] Update riskEngine.js to avoid PH-related risks when only live sensors are present
- [x] Update aiService.js so recommendations fallback is robust
- [x] Run smoke checks (`node -c ...` and `npm test`) to ensure no runtime errors


