export interface ExtractedField {
  field_name: string;
  // Extracted values can be deeply nested (dicts of dicts, lists of dicts),
  // matching ExtractedFieldCreate.extracted_value on the backend.
  extracted_value: unknown;
  confidence_score: number | null;
}

export interface FormDetails {
  user_id: string; // UUID, serialized as a string over JSON
  filename: string;
  file_url: string;
}

// Matches app/schema.py's DocumentExtractionResponse exactly.
export interface UploadResponse {
  form_details: FormDetails;
  extracted_data: ExtractedField[];
  form_type: string;
  status: 'success' | 'failed';
}