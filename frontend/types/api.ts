export interface ExtractedData {
  [key: string]: any; 
}

export interface UploadResponse {
  filename: string;
  content_type?: string;
  size_in_bytes?: number;
  form_type: string;
  status: 'success' | 'failed' | 'processing';
  message: string;
  extracted_data: ExtractedData | null;
}