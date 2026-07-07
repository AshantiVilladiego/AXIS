import fitz  # PyMuPDF
import io
import logging

logger = logging.getLogger(__name__)

# The Master Coordinate Map (X, Y pixels and Page Number)
FORM_COORDINATES = {
    "sss_e1": {
        "ssnumber": {"page": 0, "x": 415, "y": 140},
        "name": {"page": 0, "x": 60, "y": 255}, 
        "address": {"page": 0, "x": 60, "y": 320},
        "birth": {"page": 0, "x": 350, "y": 400},
        "tin": {"page": 0, "x": 420, "y": 425},
        "contact": {"page": 0, "x": 60, "y": 360},
    },
    "philhealth_pmrf": {
        "philhealth": {"page": 0, "x": 400, "y": 100},
        "name": {"page": 0, "x": 50, "y": 180},
    }
}

class PDFGeneratorService:
    @staticmethod
    def fill_pdf(original_file_bytes: bytes, fill_data: list[dict], form_type: str, filename: str = "document.pdf") -> bytes:
        try:
            # 1. Convert Images to PDF on the fly (Prevents crashes from mobile uploads)
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                ext = filename.split('.')[-1].lower()
                if ext == "jpg": ext = "jpeg"
                img_doc = fitz.open(stream=original_file_bytes, filetype=ext)
                pdf_bytes = img_doc.convert_to_pdf()
                doc = fitz.open("pdf", pdf_bytes)
            else:
                doc = fitz.open(stream=original_file_bytes, filetype="pdf")
            
            # 2. Get the specific coordinate template for this form
            template = FORM_COORDINATES.get(form_type, {})
            
            # 3. Stamp the data
            for item in fill_data:
                field_name = str(item.get("field_name", "")).lower()
                text_to_insert = str(item.get("text", "")).strip()
                
                # Skip empty data
                if not text_to_insert or text_to_insert.lower() in ["null", "undefined", "none"]:
                    continue
                
                # Search the template for a matching field name (Fuzzy Match)
                coords = None
                for key, val in template.items():
                    if key in field_name:
                        coords = val
                        break
                
                # If we don't know where to put it, DO NOT stamp it. This prevents the dark blob at 50,50!
                if not coords:
                    continue 
                    
                page_num = coords["page"]
                if page_num >= len(doc):
                    continue
                    
                page = doc[page_num]
                x = coords["x"]
                y = coords["y"]
                
                # Stamp the text
                page.insert_text(
                    fitz.Point(x, y),
                    text_to_insert,
                    fontsize=10,
                    fontname="helv",
                    color=(0.1, 0.1, 0.4) # Dark blue ink
                )
                
            # 4. Save to byte stream
            output_stream = io.BytesIO()
            doc.save(output_stream)
            doc.close()
            
            return output_stream.getvalue()
            
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            raise ValueError(f"Failed to process and stamp document: {str(e)}")