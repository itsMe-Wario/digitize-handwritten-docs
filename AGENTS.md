# AGENTS.md — AI Workflow Documentation

## AI Tools Used

| Tool | Role |
|------|------|
| **Gemini & Claude** | Development assistant — architecture design, code generation, debugging |
| **Gemini 2.0 Flash & "Mistralai** | Runtime OCR/extraction engine embedded in the product |


## How AI Was Used During Development

### 1. Architecture & Scaffolding
Gemini was used to:
- Design the full Next.js App Router project structure upfront
- Define the Mongoose schema to exactly match the business requirements
- Plan the API routes and their responsibilities before writing a single line

### 2. Code Generation
Claude generated:
- API route handlers (`/api/upload`, `/api/documents`, `/api/documents/[id]`, `/api/analytics`)
- Mongoose model with nested `confidence_scores` schema
- Validation logic (`lib/validation.ts`) with specific business rules
- All React components (Upload zone, Review form, Dashboard, History table)
- shadcn/ui component stubs (Button, Card, Badge, Input, Label, Select, Alert)
- Recharts integration for analytics (Bar, Pie, Line charts)

### 3. Debugging Workflows
- Used Claude to identify and fix TypeScript type errors in the Mongoose model
- Used Claude to fix the MongoDB aggregation pipeline for the shift-wise summary
- Used Claude to resolve the dynamic import issue with `mongoose` in Next.js

---

## Where AI Helped Most
1. **Boilerplate elimination** — shadcn/ui stubs, Mongoose models, API routes
2. **Aggregation pipelines** — MongoDB `$group`, `$match`, `$project` stages
3. **Confidence-based UI logic** — Mapping scores to conditional CSS classes
4. **Prompt engineering** — Crafting the Gemini system instruction for strict JSON output

## Areas Requiring Manual Intervention
1. Testing against real handwritten images to tune confidence thresholds
2. Fine-tuning the Gemini prompt for edge cases (e.g., multi-row sheets)
3. Adjusting validation regex patterns after seeing real data (e.g., emp_no formats)
4. Setting up MongoDB Atlas, Vercel hosting,  and Gemini+Mistralai API keys

---

## Runtime AI Integration (Gemini 2.0 Flash & Mistralai)

The product embeds both as the OCR engine in `/api/upload/route.ts`:

```
System Instruction → "expert data entry assistant for manufacturing plant"
Output → strict JSON with all fields + confidence_scores (0-100 per field)
Config → responseMimeType: "application/json" (forces structured output)
```

The confidence scores returned by the models directly drive the UI — red border for <50%, yellow for 50-69%, green for ≥70%.
