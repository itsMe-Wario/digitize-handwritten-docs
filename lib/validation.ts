export interface ExtractedData {
  date: string | null;
  shift: number | null;
  emp_no: string | null;
  opn_code: string | null;
  machine_no: string | null;
  work_order_no: string | null;
  qty_produced: number | null;
  time_taken_hrs: number | null;
  confidence_scores: {
    date: number;
    shift: number;
    emp_no: number;
    opn_code: number;
    machine_no: number;
    work_order_no: number;
    qty_produced: number;
    time_taken_hrs: number;
  };
}

export function validateRecord(data: ExtractedData): string[] {
  const errors: string[] = [];

  // Missing mandatory fields
  if (!data.date) errors.push("Missing mandatory field: date");
  if (data.shift === null || data.shift === undefined) errors.push("Missing mandatory field: shift");
  if (!data.emp_no) errors.push("Missing mandatory field: emp_no");
  if (!data.opn_code) errors.push("Missing mandatory field: opn_code");
  if (!data.machine_no) errors.push("Missing mandatory field: machine_no");
  if (!data.work_order_no) errors.push("Missing mandatory field: work_order_no");

  // Invalid shift values
  if (data.shift !== null && data.shift !== undefined && ![1, 2, 3].includes(Number(data.shift))) {
    errors.push(`Invalid shift value: ${data.shift}. Must be 1, 2, or 3`);
  }

  // Incorrect machine code format (e.g., MC-XXX)
  if (data.machine_no && !/^MC-\d{3}$/.test(data.machine_no)) {
    errors.push(`Invalid machine number format: ${data.machine_no}. Expected format: MC-XXX`);
  }

  // Suspicious numeric values
  if (data.qty_produced !== null && data.qty_produced !== undefined) {
    if (data.qty_produced < 0) errors.push("Quantity produced cannot be negative");
    if (data.qty_produced > 10000) errors.push(`Suspicious quantity produced: ${data.qty_produced} (>10000)`);
  } else {
    errors.push("Missing mandatory field: qty_produced");
  }

  if (data.time_taken_hrs !== null && data.time_taken_hrs !== undefined) {
    if (data.time_taken_hrs < 0) errors.push("Time taken cannot be negative");
    if (data.time_taken_hrs > 24) errors.push(`Suspicious time taken: ${data.time_taken_hrs} hrs (>24 hrs)`);
  } else {
    errors.push("Missing mandatory field: time_taken_hrs");
  }

  // Date format validation DD/MM/YY
  if (data.date && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(data.date)) {
    errors.push(`Invalid date format: ${data.date}. Expected DD/MM/YY`);
  }

  // Employee number format (e.g., BT4686)
  if (data.emp_no && !/^[A-Z]{2}\d{4,}$/.test(data.emp_no)) {
    errors.push(`Unusual employee number format: ${data.emp_no}`);
  }

  return errors;
}
