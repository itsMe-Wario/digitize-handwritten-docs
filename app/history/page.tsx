"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, Loader2, ChevronDown, ChevronUp,
  RefreshCw, AlertTriangle, CheckCircle, Save,
  Layers, ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopRow {
  _id: string;
  status: "Needs Review" | "Approved";
  date: string | null;
  shift: number | null;
  emp_no: string | null;
  opn_code: string | null;
  machine_no: string | null;
  work_order_no: string | null;
  qty_produced: number | null;
  time_taken_hrs: number | null;
  validation_errors: string[];
  confidence_scores: Record<string, number>;
}

interface UploadSessionGroup {
  _id: string;
  createdAt: string;
  mime_type: string;
  row_count: number;
  rows: ShopRow[];
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof FormState)[];
const STATUS_FILTERS = ["All", "Needs Review", "Approved"];

function rowToForm(row: ShopRow): FormState {
  return {
    date: row.date ?? "",
    shift: row.shift?.toString() ?? "",
    emp_no: row.emp_no ?? "",
    opn_code: row.opn_code ?? "",
    machine_no: row.machine_no ?? "",
    work_order_no: row.work_order_no ?? "",
    qty_produced: row.qty_produced?.toString() ?? "",
    time_taken_hrs: row.time_taken_hrs?.toString() ?? "",
  };
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
    score >= 70 ? "bg-green-100 text-green-700" :
    score >= 50 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", color)}>
      {score}%
    </span>
  );
}

function SessionStatusSummary({ rows }: { rows: ShopRow[] }) {
  const approved = rows.filter((r) => r.status === "Approved").length;
  const needsReview = rows.filter((r) => r.status === "Needs Review").length;
  return (
    <div className="flex items-center gap-2">
      {approved > 0 && (
        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
          {approved} Approved
        </span>
      )}
      {needsReview > 0 && (
        <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
          {needsReview} Needs Review
        </span>
      )}
    </div>
  );
}

// ── Inline Edit Panel ─────────────────────────────────────────────────────────

function SessionEditPanel({
  session,
  onRowsUpdate,
  onRowDeleted,
}: {
  session: UploadSessionGroup;
  onRowsUpdate: (sessionId: string, updatedRows: ShopRow[]) => void;
  onRowDeleted: (sessionId: string, rowId: string) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [formDataMap, setFormDataMap] = useState<Record<number, FormState>>(() => {
    const map: Record<number, FormState> = {};
    session.rows.forEach((row, i) => { map[i] = rowToForm(row); });
    return map;
  });
  const [savedMap, setSavedMap] = useState<Record<number, boolean>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [rowStatuses, setRowStatuses] = useState<Record<number, "Needs Review" | "Approved">>(() => {
    const map: Record<number, "Needs Review" | "Approved"> = {};
    session.rows.forEach((row, i) => { map[i] = row.status; });
    return map;
  });
  const [validationMap, setValidationMap] = useState<Record<number, string[]>>(() => {
    const map: Record<number, string[]> = {};
    session.rows.forEach((row, i) => { map[i] = row.validation_errors; });
    return map;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.rows[0]) { setImageLoading(false); return; }
    fetch(`/api/documents/${session.rows[0]._id}`)
      .then((r) => r.json())
      .then((data) => {
        const img = data?.upload_session_id?.original_image_base64;
        if (img) setImage(img);
      })
      .catch(console.error)
      .finally(() => setImageLoading(false));
  }, [session._id, session.rows]);

  const handleSave = async (index: number) => {
    const row = session.rows[index];
    const formData = formDataMap[index];
    if (!row || !formData) return;

    setSavingIndex(index);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${row._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      const updated = await res.json();
      setSavedMap((prev) => ({ ...prev, [index]: true }));
      setRowStatuses((prev) => ({ ...prev, [index]: "Approved" }));
      setValidationMap((prev) => ({ ...prev, [index]: updated.validation_errors ?? [] }));

      const updatedRows = session.rows.map((r, i) =>
        i === index
          ? { ...r, status: "Approved" as const, validation_errors: updated.validation_errors ?? [] }
          : r
      );
      onRowsUpdate(session._id, updatedRows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleDeleteRow = async (index: number) => {
    const row = session.rows[index];
    if (!row) return;
    if (!confirm(`Delete Row ${index + 1}? This cannot be undone.`)) return;

    setDeletingRowId(row._id);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${row._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete row");

      // Move active index back if needed
      if (activeIndex >= index && activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }

      onRowDeleted(session._id, row._id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingRowId(null);
    }
  };

  const updateField = (index: number, field: keyof FormState, value: string) => {
    setFormDataMap((prev) => ({ ...prev, [index]: { ...prev[index], [field]: value } }));
    setSavedMap((prev) => ({ ...prev, [index]: false }));
  };

  const totalRows = session.rows.length;
  const totalSaved = Object.values(savedMap).filter(Boolean).length;
  const activeRow = session.rows[activeIndex];
  const activeForm = formDataMap[activeIndex];
  const activeValidation = validationMap[activeIndex] ?? [];

  if (!activeRow || !activeForm) return null;

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Row navigator with delete row button */}
      {totalRows > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {totalRows > 1 && (
            <Button
              variant="outline" size="sm"
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="flex gap-1">
            {session.rows.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-8 h-8 rounded-md text-sm font-medium transition-colors border",
                  activeIndex === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : rowStatuses[i] === "Approved"
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {totalRows > 1 && (
            <Button
              variant="outline" size="sm"
              onClick={() => setActiveIndex((i) => Math.min(totalRows - 1, i + 1))}
              disabled={activeIndex === totalRows - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          <span className="text-sm text-gray-500">
            Row {activeIndex + 1} of {totalRows}
            {totalSaved > 0 && (
              <span className="ml-2 text-green-600 font-medium">
                · {totalSaved}/{totalRows} approved
              </span>
            )}
          </span>

          {/* Delete current row button */}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
            onClick={() => handleDeleteRow(activeIndex)}
            disabled={deletingRowId === activeRow._id}
          >
            {deletingRowId === activeRow._id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1" />
            )}
            Delete Row {activeIndex + 1}
          </Button>
        </div>
      )}

      {/* Split screen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">Original Document</p>
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 min-h-48 flex items-center justify-center">
            {imageLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : image ? (
              <img
                src={`data:${session.mime_type};base64,${image}`}
                alt="Original document"
                className="w-full object-contain"
              />
            ) : (
              <p className="text-sm text-gray-400">Image unavailable</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={rowStatuses[activeIndex] === "Approved" ? "success" : "warning"}>
              {rowStatuses[activeIndex]}
            </Badge>
            {activeValidation.length > 0 && (
              <span className="text-xs text-red-600 font-medium">
                {activeValidation.length} issue(s)
              </span>
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="space-y-4">
          {activeValidation.length > 0 && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Validation Issues — Row {activeIndex + 1}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {activeValidation.map((err, i) => (
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
              {activeIndex < totalRows - 1 && (
                <AlertDescription>
                  <button
                    className="underline font-medium text-sm"
                    onClick={() => setActiveIndex(activeIndex + 1)}
                  >
                    Review row {activeIndex + 2} →
                  </button>
                </AlertDescription>
              )}
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELD_KEYS.map((field) => {
              const score = activeRow.confidence_scores?.[field] ?? 0;
              const hasError = activeValidation.some((e) =>
                e.toLowerCase().includes(field.replace(/_/g, " ").toLowerCase())
              );
              return (
                <div key={field} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`${field}-${session._id}-${activeIndex}`}
                      className="text-xs font-medium text-gray-600"
                    >
                      {FIELD_LABELS[field]}
                    </Label>
                    <ConfidencePill score={score} />
                  </div>
                  <Input
                    id={`${field}-${session._id}-${activeIndex}`}
                    value={activeForm[field]}
                    onChange={(e) => updateField(activeIndex, field, e.target.value)}
                    placeholder={score === 0 ? "Not detected" : ""}
                    className={cn("text-sm", getFieldClass(score, hasError))}
                  />
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t flex gap-3">
            <Button
              onClick={() => handleSave(activeIndex)}
              disabled={savingIndex === activeIndex || savedMap[activeIndex]}
              className="flex-1"
            >
              {savingIndex === activeIndex ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : savedMap[activeIndex] ? (
                <><CheckCircle className="h-4 w-4" /> Approved</>
              ) : (
                <><Save className="h-4 w-4" /> Save & Approve Row {activeIndex + 1}</>
              )}
            </Button>
            {totalRows > 1 && (
              <Button
                variant="outline"
                onClick={async () => {
                  for (let i = 0; i < totalRows; i++) {
                    if (!savedMap[i]) await handleSave(i);
                  }
                }}
                disabled={savingIndex !== null || totalSaved === totalRows}
              >
                {totalSaved === totalRows ? "All Approved" : "Approve All"}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-400 pt-1">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />
              ≥70% confident
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block" />
              50–69%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block" />
              &lt;50% / error
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [sessions, setSessions] = useState<UploadSessionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "All") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      setSessions(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRowsUpdate = (sessionId: string, updatedRows: ShopRow[]) => {
    setSessions((prev) =>
      prev.map((s) => s._id === sessionId ? { ...s, rows: updatedRows } : s)
    );
  };

  // Called when a single row is deleted inside the edit panel
  const handleRowDeleted = (sessionId: string, rowId: string) => {
    setSessions((prev) =>
      prev
        .map((s) => {
          if (s._id !== sessionId) return s;
          const updatedRows = s.rows.filter((r) => r._id !== rowId);
          return { ...s, rows: updatedRows, row_count: updatedRows.length };
        })
        // Remove the session card entirely if it has no rows left
        .filter((s) => s.rows.length > 0)
    );
  };

  // Delete an entire session and all its rows
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't toggle expand
    if (!confirm("Delete this entire upload and all its rows? This cannot be undone.")) return;

    setDeletingSessionId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete session");
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (expandedId === sessionId) setExpandedId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Upload History</h1>
        <p className="text-gray-500 mt-1">
          Browse all processed document uploads. Click a card to review or edit its rows.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search & Filter */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by Work Order, Employee No., or Machine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {STATUS_FILTERS.map((opt) => (
                <Button
                  key={opt}
                  variant={statusFilter === opt ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No uploads found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isExpanded = expandedId === session._id;
            const uploadDate = new Date(session.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const isDeletingThis = deletingSessionId === session._id;

            return (
              <Card
                key={session._id}
                className={cn(
                  "transition-shadow",
                  isExpanded ? "shadow-md ring-1 ring-blue-200" : "hover:shadow-sm"
                )}
              >
                {/* Card header — click to expand, delete button on right */}
                <CardHeader
                  className="cursor-pointer py-4 px-6"
                  onClick={() => toggleExpand(session._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Layers className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold text-sm">{uploadDate}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {session.rows.length} row{session.rows.length !== 1 ? "s" : ""}
                      </span>
                      <SessionStatusSummary rows={session.rows} />
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Delete entire session */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => handleDeleteSession(session._id, e)}
                        disabled={isDeletingThis}
                        title="Delete this upload and all its rows"
                      >
                        {isDeletingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <CardContent className="px-6 pb-6">
                    <SessionEditPanel
                      session={session}
                      onRowsUpdate={handleRowsUpdate}
                      onRowDeleted={handleRowDeleted}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}