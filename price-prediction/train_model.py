from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE = Path(__file__).resolve().parent
DATA = BASE / "maharashtra_banana_prices.csv"
MODEL = BASE / "banana_price_model.joblib"

df = pd.read_csv(DATA, parse_dates=["date"])
df = df.sort_values("date").drop_duplicates("date")
df["modal_price"] = pd.to_numeric(df["modal_price"], errors="coerce")
df = df.dropna(subset=["date", "modal_price"])
df = df[df["modal_price"] > 0].copy()

if len(df) < 100:
    raise SystemExit("Expected at least 100 valid observations.")

df["lag_1"] = df["modal_price"].shift(1)
df["lag_2"] = df["modal_price"].shift(2)
df["lag_3"] = df["modal_price"].shift(3)
df["rolling_mean_3"] = df["modal_price"].shift(1).rolling(3).mean()
df["day_of_week"] = df["date"].dt.dayofweek
data = df.dropna().copy()

features = ["lag_1", "lag_2", "lag_3", "rolling_mean_3", "day_of_week"]
split = int(len(data) * 0.8)
train, test = data.iloc[:split], data.iloc[split:]

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=6,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1
)
model.fit(train[features], train["modal_price"])
pred = model.predict(test[features])

actual = test["modal_price"].to_numpy()
baseline = test["lag_1"].to_numpy()
mae = float(mean_absolute_error(actual, pred))
baseline_mae = float(mean_absolute_error(actual, baseline))
rmse = float(np.sqrt(mean_squared_error(actual, pred)))

# Evaluate chronologically, then refit the deployable model on all available rows.
final_model = RandomForestRegressor(
    n_estimators=300,
    max_depth=6,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1
)
final_model.fit(data[features], data["modal_price"])
joblib.dump({"model": final_model, "features": features}, MODEL)

metrics = {
    "source": "CEDA Agmarknet API",
    "region": "Maharashtra",
    "commodity": "Banana",
    "unit": "Source price units; verify unit before converting",
    "observations": int(len(df)),
    "training_rows": int(len(train)),
    "test_rows": int(len(test)),
    "date_start": str(df["date"].min().date()),
    "date_end": str(df["date"].max().date()),
    "test_mae": round(mae, 2),
    "test_rmse": round(rmse, 2),
    "previous_price_baseline_mae": round(baseline_mae, 2),
    "beats_baseline": bool(mae < baseline_mae),
    "evaluation_method": "Chronological holdout; final model refitted on all observations",
    "warning": "Historical experimental model. Last available observation may not represent current market prices."
}
(BASE / "evaluation.json").write_text(json.dumps(metrics, indent=2))
print(json.dumps(metrics, indent=2))
print("\nModel and evaluation saved.")
