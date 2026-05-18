import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import connectDB from "@/lib/mongodb";
import ShopRecord from "@/lib/models/ShopRecord";
import UploadSession from "@/lib/models/UploadSession";
import { validateRecord, ExtractedData } from "@/lib/validation";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY as string;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const mistral = new Mistral({ apiKey: MISTRAL_API_KEY });

const EXTRACTION_PROMPT = `Extract ALL non-empty rows from this handwritten machine shop log as a JSON array.
Each element must have: date (string DD/MM/YY), shift (integer 1/2/3 — convert Roman numerals I->1 II->2 III->3), emp_no (string), opn_code (string), machine_no (string like MC-XXX), work_order_no (string), qty_produced (number or null), time_taken_hrs (number or null), confidence_scores (object with 0-100 score for each field).
Return only the JSON array, no other text.`;

const SYSTEM_INSTRUCTION = `You are an expert data entry assistant for a manufacturing plant. Read the provided handwritten log sheet and extract ALL non-empty rows into a JSON array. Each row becomes one object. If a field is illegible or missing use null. The shift field must always be returned as an integer (1, 2, or 3) even if written as a Roman numeral (I, II, III). Include a confidence_scores object per row rating certainty 0-100 for each field.`;

// ── Sanitisers ────────────────────────────────────────────────────────────────

function parseShift(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim().toUpperCase();
  const romanMap: Record<string, number> = {
    I: 1, II: 2, III: 3, "1": 1, "2": 2, "3": 3,
  };
  if (romanMap[str] !== undefined) return romanMap[str];
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  return String(value).trim();
}

function parseAndSanitiseRows(responseText: string): ExtractedData[] {
  const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const rows: ExtractedData[] = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((raw) => ({
    date: parseString(raw.date),
    shift: parseShift(raw.shift),
    emp_no: parseString(raw.emp_no),
    opn_code: parseString(raw.opn_code),
    machine_no: parseString(raw.machine_no),
    work_order_no: parseString(raw.work_order_no),
    qty_produced: parseNumber(raw.qty_produced),
    time_taken_hrs: parseNumber(raw.time_taken_hrs),
    confidence_scores: raw.confidence_scores ?? {
      date: 0, shift: 0, emp_no: 0, opn_code: 0,
      machine_no: 0, work_order_no: 0, qty_produced: 0, time_taken_hrs: 0,
    },
  }));
}

// ── AI Providers ──────────────────────────────────────────────────────────────

async function extractWithGemini(base64Image: string, mimeType: string): Promise<ExtractedData[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: SYSTEM_INSTRUCTION,
  });
  const result = await model.generateContent([
    { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Image } },
    { text: EXTRACTION_PROMPT },
  ]);
  return parseAndSanitiseRows(result.response.text());
}

async function extractWithMistral(base64Image: string, mimeType: string): Promise<ExtractedData[]> {
  const response = await mistral.chat.complete({
    model: "pixtral-12b-latest",
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      {
        role: "user",
        content: [
          { type: "image_url", imageUrl: `data:${mimeType || "image/jpeg"};base64,${base64Image}` },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });
  const text = response.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") throw new Error("Mistral returned an empty response.");
  return parseAndSanitiseRows(text);
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64Image, mimeType } = body;

    if (!base64Image) {
      return NextResponse.json({ error: "No image data provided." }, { status: 400 });
    }

    const estimatedBytes = (base64Image.length * 3) / 4;
    if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit." }, { status: 413 });
    }

    // ── Try Gemini, fall back to Mistral ──────────────────────────────────
    let extractedRows: ExtractedData[];
    let usedProvider = "Gemini";

    try {
      extractedRows = await extractWithGemini(base64Image, mimeType);
    } catch (geminiError) {
      console.warn("Gemini failed, falling back to Mistral:", geminiError);
      usedProvider = "Mistral";
      try {
        extractedRows = await extractWithMistral(base64Image, mimeType);
      } catch (mistralError) {
        console.error("Both AI providers failed:", mistralError);
        return NextResponse.json(
          { error: "Both AI providers are unavailable. Please try again later." },
          { status: 503 }
        );
      }
    }

    await connectDB();

    // ── Save image ONCE as an UploadSession ───────────────────────────────
    const session = new UploadSession({
      original_image_base64: base64Image,
      mime_type: mimeType || "image/jpeg",
      row_count: extractedRows.length,
    });
    const savedSession = await session.save();

    // ── Save each row as a ShopRecord referencing the session ─────────────
    const savedRecords = [];

    for (const sanitized of extractedRows) {
      const validationErrors = validateRecord(sanitized);

      const record = new ShopRecord({
        upload_session_id: savedSession._id,
        status: "Needs Review",
        date: sanitized.date,
        shift: sanitized.shift,
        emp_no: sanitized.emp_no,
        opn_code: sanitized.opn_code,
        machine_no: sanitized.machine_no,
        work_order_no: sanitized.work_order_no,
        qty_produced: sanitized.qty_produced,
        time_taken_hrs: sanitized.time_taken_hrs,
        confidence_scores: sanitized.confidence_scores,
        validation_errors: validationErrors,
      });

      const saved = await record.save();
      savedRecords.push(saved);
    }

    return NextResponse.json(
      { records: savedRecords, provider: usedProvider, session_id: savedSession._id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload." },
      { status: 500 }
    );
  }
}