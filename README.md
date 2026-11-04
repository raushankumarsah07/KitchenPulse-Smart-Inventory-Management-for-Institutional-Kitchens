# KitchenPulse: Smart Inventory Management for Institutional Kitchens

A full-stack web app for college canteens and hostel messes. It tracks stock, warns about low stock and
expiry, records waste, and uses machine learning to forecast demand and suggest what to buy, with the
working shown.

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), Chart.js, Framer Motion, hand-written CSS design system (light and dark) |
| Backend | Node.js, Express, JWT + bcrypt, zod validation |
| Database | MongoDB (Mongoose) |
| ML service | Python, FastAPI, pandas, NumPy, scikit-learn |

## Run it (about 5 minutes)

You need **Node 18+**, **Python 3.10+** and **MongoDB** (local install, MongoDB Atlas, or `docker compose up -d`).

```bash
# 1. install everything
npm install                       # root (concurrently)
npm install --prefix server
npm install --prefix client
pip install -r ml-service/requirements.txt

# 2. configure the backend
cp server/.env.example server/.env      # then set JWT_SECRET to a long random string
                                        # (Atlas users: set MONGODB_URI)

# 3. start (three terminals, or 'npm run dev' for api + web together)
npm run dev:ml                    # ML service  -> http://localhost:8000
npm run dev                       # API :5000 and web app :5173
```

Open **http://localhost:5173**, register (the **first account becomes the manager**), then on the
dashboard click **Load demo data** for 90 days of clearly labelled synthetic history so you can try every
screen at once. Run `npm test` for the backend end-to-end tests (needs MongoDB).

**Single-process mode:** `npm start` builds the React app and the Express server then serves it on port 5000.

## How it maps to your presentation

| Slide / module | Where it lives |
|---|---|
| Dashboard | `client/src/pages/Dashboard.jsx`, `server/src/routes/dashboard.js` |
| Inventory management | `Inventory.jsx`, `routes/ingredients.js` |
| Expiry tracking, first-expiring-first-out | `server/src/services/stock.js` (`deduct`): batches are consumed earliest-expiry first and expired stock is never used for cooking |
| Smart alerts | `services/alerts.js` (out of stock, low, expiring, expired) + the bell in the top bar |
| Demand forecasting | `ml-service/main.py` + `routes/forecast.js` + `Forecast.jsx` |
| Waste tracking | `Waste.jsx`, `routes/waste.js`: cost is taken from the exact batches wasted |
| Reports | `Reports.jsx`, `routes/reports.js`: period summary, per ingredient, per day, CSV export, print |
| Explainable purchase suggestion | predicted need + safety stock − usable stock − pending delivery = buy |
| JWT + bcrypt | `routes/auth.js`, `middleware/auth.js` |

## How the forecast works (be ready to explain this in your viva)

1. The backend sends the last ~120 days of daily usage for one ingredient to the Python service.
2. The service builds features (day of week, yesterday, same weekday last week, 7- and 14-day averages).
3. It holds out the last ~25% of days and compares three models on that unseen data:
   a **moving average** (baseline), **linear regression** and a **random forest**.
4. It picks the lowest-error model (MAE), refits it on all data and predicts the next 1 to 14 days.
5. If the learning models cannot beat the baseline, or there are fewer than 28 days of data, it says so and uses the baseline.
6. If the ML service is down, the backend falls back to a 7-day average and flags it in the UI.

**Honest note:** the demo data is synthetic, so the accuracy numbers shown with it only demonstrate the method.
Evaluate on real canteen records before claiming accuracy.

## Design decisions worth knowing

- **Stock is derived from batches** (each purchase has quantity, remaining, cost and expiry), so it cannot drift out of sync.
- **Every usage and waste entry stores which batches it came from**, so deleting an entry restores stock exactly.
- **Ingredients are archived, not deleted**, so old reports stay correct.
- **Roles:** the manager can archive ingredients and load or clear demo data; staff can record purchases, usage and waste.
- Set `TZ_OFFSET_MIN` in `server/.env` for your timezone (default 330 = India Standard Time).

## API summary (all under `/api`, JWT required except auth)

`POST /auth/register|login` · `GET /auth/me` · `GET|POST /ingredients` · `PATCH|DELETE /ingredients/:id` ·
`GET /ingredients/:id/batches` · `GET|POST /purchases` · `GET|POST /consumption` · `GET|POST /waste` ·
`GET /alerts` · `GET /dashboard` · `GET /reports?from&to` · `POST /forecast` · `POST /demo/seed` · `DELETE /demo`

## Deploying

Frontend on Vercel (set `VITE_API_URL` to your API URL), API and ML service on Render or similar, database on
MongoDB Atlas. Set `CLIENT_ORIGIN` on the API to your frontend URL and `ML_SERVICE_URL` to the ML service URL.
