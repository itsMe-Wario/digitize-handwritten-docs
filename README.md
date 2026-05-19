# Digitizer | Hosted Link : https://digitize-handwritten-docs.vercel.app/

An AI-Powered System that digitizes handwritten log sheets using APIS, stores structured records in MongoDB, and provides a human review workflow with analytics.

---

## Features

- **AI OCR Extraction** — Upload handwritten machine shop logs;AI extracts structured data with per-field confidence scores
- **Split-Screen Review** — Side-by-side original image and editable form; low-confidence fields highlighted in red/yellow
- **Validation Engine** — Business rules: shift range, machine code format, quantity bounds, missing mandatory fields
- **Dashboard Analytics** — Recharts-powered: status pie, machine quantity bar, shift summary, upload trend
- **History & Search** — Full table of all records, filterable by status, searchable by Work Order / Emp No / Machine

---

## Project Structure

```
machine-shop-app/
├── app/
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts          # POST — receive base64, call Gemini, save to MongoDB
│   │   ├── documents/
│   │   │   ├── route.ts          # GET — list all documents (no image field)
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET, PUT, DELETE — single record operations
│   │   └── analytics/
│   │       └── route.ts          # GET — MongoDB aggregation pipelines for charts
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard view with recharts analytics
│   ├── history/
│   │   └── page.tsx              # History/search table view
│   ├── globals.css               # Tailwind + CSS variables (shadcn/ui theme)
│   ├── layout.tsx                # Root layout with Navbar
│   └── page.tsx                  # Upload & Review (main page)
├── components/
│   ├── ui/
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── select.tsx
│   └── Navbar.tsx
├── lib/
│   ├── models/
│   │   └── ShopRecord.ts         # Mongoose schema (status, image, fields, confidence_scores)
│   ├── mongodb.ts                # Connection singleton with global caching
│   ├── utils.ts                  # cn() helper for Tailwind class merging
│   └── validation.ts             # Business rule validators
├── .env.local.example            # Environment variable template
├── AGENTS.md                     # AI workflow documentation
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- A [MongoDB Atlas](https://cloud.mongodb.com) free-tier cluster (or local MongoDB)
- A [Google AI Studio](https://aistudio.google.com) API key (free tier)
- A .[Mistral AI] (https://.mistral.ai) API key (free tire)

### 1. Clone & Install

```bash
cd machine-shop-app
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/machine_shop?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

---

## Usage

1. **Upload** — Go to the home page, drag & drop or click to upload a handwritten machine shop log (JPEG/PNG, max 5MB)
2. **Review** — AI extracts data and displays it side-by-side with the original image. Red/yellow fields need attention
3. **Correct & Approve** — Edit any incorrect fields, then click "Save & Approve"
4. **Analytics** — Visit the Dashboard to see charts of processed documents
5. **History** — Visit History to search and browse all past uploads

---

## Database Schema

```typescript
{
  status: "Needs Review" | "Approved",  // defaults to "Needs Review"
  original_image_base64: string,          // full base64 image stored in MongoDB
  date: string | null,                    // "DD/MM/YY" format
  shift: number | null,                   // 1, 2, or 3
  emp_no: string | null,                  // e.g., "BT4686"
  opn_code: string | null,
  machine_no: string | null,              // e.g., "MC-720"
  work_order_no: string | null,
  qty_produced: number | null,
  time_taken_hrs: number | null,
  confidence_scores: {                    // 0-100 per field (from Gemini)
    date, shift, emp_no, opn_code,
    machine_no, work_order_no,
    qty_produced, time_taken_hrs
  },
  validation_errors: string[],           // business rule violations
  createdAt: Date,
  updatedAt: Date
}
```

---

## Validation Rules

| Rule | Check |
|------|-------|
| Mandatory fields | date, shift, emp_no, opn_code, machine_no, work_order_no, qty_produced, time_taken_hrs |
| Shift values | Must be 1, 2, or 3 |
| Machine code format | Must match `MC-XXX` (e.g., MC-720) |
| Quantity bounds | 0 < qty ≤ 10,000 |
| Time bounds | 0 < time ≤ 24 hrs |
| Date format | Must match DD/MM/YY pattern |
| Employee number | Must match `XX9999` format (e.g., BT4686) |

---

## Assumptions & Tradeoffs

1. **Base64 in MongoDB** — Per requirements, images are stored directly in MongoDB as base64 strings. For production scale, cloud object storage (S3, GCS) would be more efficient.
2. **5MB limit** — Enforced both client-side (before upload) and server-side (before Gemini call).
3. **Single-row extraction** — The AI prompt extracts one record per image. Multi-row sheets require post-processing (future enhancement).
4. **Confidence thresholds** — `<50%` = red, `50-69%` = yellow, `≥70%` = green. These are tunable constants.
5. **No auth** — Authentication is out of scope for this prototype. For production, add NextAuth.js.

---

## Deployment (Free Tier)

**Vercel** :
Add environment variables in Vercel Dashboard → Settings → Environment Variables.

**MongoDB Atlas Free Tier**: M0 cluster (512MB) is sufficient for this prototype.
