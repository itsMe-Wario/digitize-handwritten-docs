"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileImage,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ExtractedRecord {
  _id: string;
  status: string;
  date: string | null;
  shift: number | null;
  emp_no: string | null;
  opn_code: string | null;
  machine_no: string | null;
  work_order_no: string | null;
  qty_produced: number | null;
  time_taken_hrs: number | null;
  confidence_scores: Record<string, number>;
  validation_errors: string[];
  original_image_base64: string;
}

interface FormState {
  date: string;
  shift: string;
  emp_no: string;
  opn_code: string;
  machine_no: string;
  work_order_no: string;
  qty_produced: string;
  time_taken_hrs: string;
}

function getFieldClass(score: number, hasError: boolean): string {
  if (hasError || score < 50)
    return "border-red-400 bg-red-50 focus-visible:ring-red-400";
  if (score < 70)
    return "border-yellow-400 bg-yellow-50 focus-visible:ring-yellow-400";
  return "border-green-300 bg-green-50";
}

function ConfidencePill({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 50
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", color)}>
      {score}%
    </span>
  );
}

const FIELD_LABELS: Record<keyof FormState, string> = {
  date: "Date (DD/MM/YY)",
  shift: "Shift (1/2/3)",
  emp_no: "Employee No.",
  opn_code: "Operation Code",
  machine_no: "Machine No.",
  work_order_no: "Work Order No.",
  qty_produced: "Qty. Produced",
  time_taken_hrs: "Time Taken (hrs)",
};

function recordToForm(record: ExtractedRecord): FormState {
  return {
    date: record.date ?? "",
    shift: record.shift?.toString() ?? "",
    emp_no: record.emp_no ?? "",
    opn_code: record.opn_code ?? "",
    machine_no: record.machine_no ?? "",
    work_order_no: record.work_order_no ?? "",
    qty_produced: record.qty_produced?.toString() ?? "",
    time_taken_hrs: record.time_taken_hrs?.toString() ?? "",
  };
}

function ProviderBadge({ provider }: { provider: string }) {
  const isGemini = provider === "Gemini";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
        isGemini
          ? "bg-blue-100 text-blue-700"
          : "bg-orange-100 text-orange-700"
      )}
    >
      <Cpu className="h-3 w-3" />
      {provider}
      {!isGemini && " (fallback)"}
    </span>
  );
}

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [uploading, setUploading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [formDataMap, setFormDataMap] = useState<Record<number, FormState>>({});
  const [savedMap, setSavedMap] = useState<Record<number, boolean>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setRecords([]);
    setFormDataMap({});
    setSavedMap({});
    setActiveIndex(0);
    setProvider(null);

    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 5MB limit.");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Only image files (JPEG, PNG, WEBP) and PDFs are accepted.");
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setBase64Image(result.split(",")[1]);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleUpload = async () => {
    if (!base64Image) return;
    setUploading(true);
    setError(null);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image, mimeType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      // API now returns { records: [...], provider: "Gemini" | "Mistral" }
      const data = await res.json();
      const allRecords: ExtractedRecord[] = Array.isArray(data)
        ? data
        : data.records ?? [];

      setProvider(data.provider ?? null);
      setRecords(allRecords);
      setActiveIndex(0);

      const initialForms: Record<number, FormState> = {};
      allRecords.forEach((rec, i) => {
        initialForms[i] = recordToForm(rec);
      });
      setFormDataMap(initialForms);
      setSavedMap({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (index: number) => {
    const record = records[index];
    const formData = formDataMap[index];
    if (!record || !formData) return;

    setSavingIndex(index);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${record._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      setSavedMap((prev) => ({ ...prev, [index]: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setBase64Image(null);
    setRecords([]);
    setFormDataMap({});
    setSavedMap({});
    setActiveIndex(0);
    setError(null);
    setProvider(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateField = (index: number, field: keyof FormState, value: string) => {
    setFormDataMap((prev) => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }));
    setSavedMap((prev) => ({ ...prev, [index]: false }));
  };

  const fieldKeys = Object.keys(FIELD_LABELS) as (keyof FormState)[];
  const totalRecords = records.length;
  const totalSaved = Object.values(savedMap).filter(Boolean).length;

  const activeRecord = records[activeIndex];
  const activeForm = formDataMap[activeIndex];
  if (totalRecords > 0 && !activeRecord) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload & Review</h1>
        <p className="text-gray-500 mt-1">
          Upload a handwritten machine shop log sheet for AI extraction and review.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {totalRecords === 0 ? (
        /* ── UPLOAD ZONE ── */
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Drag & drop or click to upload. Max 5MB. All rows in the sheet
                will be extracted automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                  dragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage className="mx-auto h-14 w-14 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">
                  {dragActive ? "Drop to upload" : "Drag & drop your file here"}
                </p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {previewUrl && (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full max-h-64 object-contain bg-gray-50"
                    />
                    <button
                      onClick={handleReset}
                      className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting all rows with AI...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Extract & Process
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── SPLIT-SCREEN REVIEW ── */
        <div className="space-y-4">
          {/* Banner */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3 text-blue-800">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">
                {totalRecords} row{totalRecords !== 1 ? "s" : ""} extracted
                from this sheet
              </span>
              {provider && <ProviderBadge provider={provider} />}
              {totalSaved > 0 && (
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {totalSaved}/{totalRecords} approved
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              New Upload
            </Button>
          </div>

          {/* Row navigator */}
          {totalRecords > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                disabled={activeIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1">
                {records.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "w-8 h-8 rounded-md text-sm font-medium transition-colors border",
                      activeIndex === i
                        ? "bg-blue-600 text-white border-blue-600"
                        : savedMap[i]
                        ? "bg-green-50 text-green-700 border-green-300"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActiveIndex((i) => Math.min(totalRecords - 1, i + 1))
                }
                disabled={activeIndex === totalRecords - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500 ml-2">
                Reviewing row {activeIndex + 1} of {totalRecords}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Original Image */}
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Original Document</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={`data:${mimeType};base64,${base64Image}`}
                  alt="Original document"
                  className="w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                />
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Badge variant={savedMap[activeIndex] ? "success" : "warning"}>
                    {savedMap[activeIndex] ? "Approved" : "Needs Review"}
                  </Badge>
                  <span className="text-xs text-gray-400">Row {activeIndex + 1}</span>
                  {activeRecord.validation_errors.length > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      {activeRecord.validation_errors.length} validation issue(s)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: Editable Form */}
            <div className="space-y-4">
              {activeRecord.validation_errors.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Issues — Row {activeIndex + 1}</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {activeRecord.validation_errors.map((err, i) => (
                        <li key={i} className="text-xs">{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {savedMap[activeIndex] && (
                <Alert className="border-green-400 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Row {activeIndex + 1} Approved!</AlertTitle>
                  <AlertDescription>
                    This record has been saved.
                    {activeIndex < totalRecords - 1 && (
                      <button
                        className="ml-2 underline font-medium"
                        onClick={() => setActiveIndex(activeIndex + 1)}
                      >
                        Review row {activeIndex + 2} →
                      </button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Extracted Data — Row {activeIndex + 1}
                    </CardTitle>
                    <span className="text-xs text-gray-400">
                      Red/yellow = low confidence or error
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeForm && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fieldKeys.map((field) => {
                        const score = activeRecord.confidence_scores?.[field] ?? 0;
                        const hasError = activeRecord.validation_errors.some((e) =>
                          e.toLowerCase().includes(field.replace(/_/g, " ").toLowerCase())
                        );
                        return (
                          <div key={field} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`${field}-${activeIndex}`}
                                className="text-xs font-medium text-gray-600"
                              >
                                {FIELD_LABELS[field]}
                              </Label>
                              <ConfidencePill score={score} />
                            </div>
                            <Input
                              id={`${field}-${activeIndex}`}
                              value={activeForm[field]}
                              onChange={(e) =>
                                updateField(activeIndex, field, e.target.value)
                              }
                              placeholder={score === 0 ? "Not detected" : ""}
                              className={cn(
                                "text-sm transition-colors",
                                getFieldClass(score, hasError)
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2 border-t flex gap-3">
                    <Button
                      onClick={() => handleSave(activeIndex)}
                      disabled={savingIndex === activeIndex || savedMap[activeIndex]}
                      className="flex-1"
                    >
                      {savingIndex === activeIndex ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : savedMap[activeIndex] ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Approved
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save & Approve Row {activeIndex + 1}
                        </>
                      )}
                    </Button>

                    {totalRecords > 1 && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          for (let i = 0; i < totalRecords; i++) {
                            if (!savedMap[i]) await handleSave(i);
                          }
                        }}
                        disabled={savingIndex !== null || totalSaved === totalRecords}
                      >
                        {totalSaved === totalRecords ? "All Approved" : "Approve All"}
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />
                      ≥70% confident
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block" />
                      50–69% — review
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block" />
                      &lt;50% / error
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}