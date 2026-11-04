"""Demand-forecasting microservice for the Smart Kitchen app.

POST /forecast  {series: [{date, quantity}], horizon}
  1. Builds a daily series and features (day of week, lags, rolling mean).
  2. Evaluates three models on a held-out tail of the data (never on training rows):
       - Moving average (baseline)
       - Linear Regression
       - Random Forest Regressor
  3. Picks the model with the lowest MAE, refits it on all data and forecasts
     `horizon` days ahead (recursively), with an approximate 80% interval.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

app = FastAPI(title="Smart Kitchen Forecast Service", version="1.0.0")

MA_WINDOW = 7
MIN_POINTS_ML = 21  # below this we only offer the moving-average baseline


class Point(BaseModel):
    date: str
    quantity: float = Field(ge=0)
    meals: float | None = None


class ForecastRequest(BaseModel):
    series: list[Point]
    horizon: int = Field(default=7, ge=1, le=30)


def _features(history: list[float], dow: int) -> list[float]:
    """Features for predicting the next day from the previous values."""
    h = history
    last7 = h[-7:]
    return [
        h[-1],
        h[-7] if len(h) >= 7 else h[-1],
        float(np.mean(last7)),
        float(np.mean(h[-14:])) if len(h) >= 14 else float(np.mean(last7)),
        *[1.0 if dow == d else 0.0 for d in range(7)],
    ]


def _dataset(values: list[float], dates: pd.DatetimeIndex, start: int = 14):
    X, y = [], []
    for i in range(start, len(values)):
        X.append(_features(values[:i], dates[i].dayofweek))
        y.append(values[i])
    return np.array(X), np.array(y)


def _metrics(actual: np.ndarray, pred: np.ndarray) -> dict:
    err = actual - pred
    return {"mae": float(np.mean(np.abs(err))), "rmse": float(np.sqrt(np.mean(err**2)))}


def _make(name: str):
    if name == "Linear Regression":
        return LinearRegression()
    return RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=0, n_jobs=1)


def _ma_one_step(values: list[float], idxs: range) -> np.ndarray:
    return np.array([np.mean(values[max(0, i - MA_WINDOW):i]) for i in idxs])


def _recursive(model, values: list[float], last_date: pd.Timestamp, horizon: int, ma: bool) -> list[float]:
    hist = list(values)
    out = []
    for step in range(1, horizon + 1):
        date = last_date + pd.Timedelta(days=step)
        if ma:
            pred = float(np.mean(hist[-MA_WINDOW:]))
        else:
            pred = float(model.predict(np.array([_features(hist, date.dayofweek)]))[0])
        pred = max(0.0, pred)
        out.append(pred)
        hist.append(pred)
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/forecast")
def forecast(req: ForecastRequest):
    if len(req.series) < 3:
        raise HTTPException(status_code=422, detail="Need at least 3 days of history.")
    df = pd.DataFrame([p.model_dump() for p in req.series])
    df["date"] = pd.to_datetime(df["date"])
    s = df.groupby("date")["quantity"].sum().sort_index()
    s = s.reindex(pd.date_range(s.index.min(), s.index.max(), freq="D"), fill_value=0.0)
    values = s.tolist()
    dates = s.index
    n = len(values)
    warnings: list[str] = []
    models: list[dict] = []
    fitted = {}

    # Hold out the last ~25% (at least 7 days) for honest evaluation.
    test_n = max(7, n // 4)
    split = n - test_n
    baseline_name = f"Moving average ({MA_WINDOW} days)"

    if n >= MIN_POINTS_ML and split > 21:
        test_idx = range(split, n)
        ma_pred = _ma_one_step(values, test_idx)
        actual = np.array(values[split:])
        models.append({"name": baseline_name, **_metrics(actual, ma_pred), "baseline": True})
        X, y = _dataset(values[:split], dates[:split])
        Xt = np.array([_features(values[:i], dates[i].dayofweek) for i in test_idx])
        for name in ("Linear Regression", "Random Forest"):
            m = _make(name).fit(X, y)
            models.append({"name": name, **_metrics(actual, np.maximum(0, m.predict(Xt))), "baseline": False})
        best = min(models, key=lambda m: m["mae"])["name"]
        if best != baseline_name:
            Xa, ya = _dataset(values, dates)
            fitted[best] = _make(best).fit(Xa, ya)
    else:
        warnings.append(
            f"Only {n} days of history: the learning models need at least {MIN_POINTS_ML + 7}. "
            "Showing the moving-average baseline. Record more daily usage for better forecasts."
        )
        recent = np.array(values[-min(n, 7):])
        models.append({"name": baseline_name, "mae": None, "rmse": None, "baseline": True})
        best = baseline_name

    is_ma = best == baseline_name
    preds = _recursive(None if is_ma else fitted[best], values, dates[-1], req.horizon, is_ma)
    best_row = next(m for m in models if m["name"] == best)
    base_row = next(m for m in models if m["baseline"])
    band = 1.28 * best_row["rmse"] if best_row.get("rmse") is not None else None
    improvement = None
    if base_row["mae"] and not is_ma:
        improvement = round(100.0 * (base_row["mae"] - best_row["mae"]) / base_row["mae"], 1)
    if is_ma and len(models) > 1:
        warnings.append("The moving-average baseline beat the learning models on held-out data, so it was used.")

    return {
        "best": best,
        "models": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in m.items()} for m in models],
        "improvementOverBaselinePct": improvement,
        "warnings": warnings,
        "evaluation": {"trainDays": split if n >= MIN_POINTS_ML else n, "testDays": test_n if n >= MIN_POINTS_ML else 0},
        "predictions": [
            {
                "date": (dates[-1] + pd.Timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                "quantity": round(p, 3),
                "lower": round(max(0.0, p - band), 3) if band is not None else None,
                "upper": round(p + band, 3) if band is not None else None,
            }
            for i, p in enumerate(preds)
        ],
    }
