import fitz  # PyMuPDF
import io
import logging

logger = logging.getLogger(__name__)

class PDFGeneratorService:
    @staticmethod
    def fill_pdf(original_pdf_bytes: bytes, fill_data: list[dict]) -> bytes:
        """
        Injects text into a PDF based on coordinates.
        Expected fill_data format: 
        [{"page": 0, "x": 120, "y": 300, "text": "Juan dela Cruz"}]
        """
        try:
            # Open the PDF directly from memory (no saving to disk required)
            doc = fitz.open(stream=original_pdf_bytes, filetype="pdf")
            
            for item in fill_data:
                page_num = item.get("page", 0)
                
                # Safety check to ensure we don't write out of bounds
                if page_num >= len(doc):
                    continue
                    
                page = doc[page_num]
                text_to_insert = str(item.get("text", ""))
                x = item.get("x", 50)
                y = item.get("y", 50)
                
                # Stamp the text onto the document
                page.insert_text(
                    fitz.Point(x, y),
                    text_to_insert,
                    fontsize=11,
                    fontname="helv",      # Standard Helvetica
                    color=(0.1, 0.1, 0.4) # Dark blue ink so it looks "filled out"
                )
                
            # Save the modified document back to a byte stream
            output_stream = io.BytesIO()
            doc.save(output_stream)
            doc.close()
            
            return output_stream.getvalue()
            
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            raise ValueError("Failed to generate PDF")