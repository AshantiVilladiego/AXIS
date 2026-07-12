import fitz  # PyMuPDF
import io
import logging
import re

logger = logging.getLogger(__name__)

# The Anchor Map: connects a normalized field key to the printed label the
# engine should search for on the page. 
ANCHOR_MAPS = {
    "sss_e1": {
        "ssnumber": "SS NUMBER",
        "sssnumber": "SS NUMBER",
        "lastname": "(LAST NAME)",
        "surname": "(LAST NAME)",
        "familyname": "(LAST NAME)",
        "firstname": "(FIRST NAME)",
        "givenname": "(FIRST NAME)",
        "middlename": "(MIDDLE NAME)",
        "suffix": "(SUFFIX)",
        "namesuffix": "(SUFFIX)",
        "birthdate": "DATE OF BIRTH",
        "dateofbirth": "DATE OF BIRTH",
        "taxpayerid": "TAX IDENTIFICATION NUMBER",
        "taxid": "TAX IDENTIFICATION NUMBER",
        "tin": "TAX IDENTIFICATION NUMBER",
        "taxidentificationnumber": "TAX IDENTIFICATION NUMBER",

        # --- NEWLY ADDED ANCHORS FOR MISSING FIELDS ---
        "nationality": "NATIONALITY",
        "religion": "RELIGION",
        "placeofbirth": "PLACE OF BIRTH",
        "roomfloorunitbuildingname": "(RM./FLR./UNIT NO. & BLDG. NAME)",
        "subdivision": "(SUBDIVISION)",
        "relationship": "RELATIONSHIP",
        "professionbusiness": "Profession/Business",
        "yearprofbusinessstarted": "Year Prof./Business Started",
        "foreignaddress": "Foreign Address",
        # ----------------------------------------------

        "houselotblkno": "(HOUSE/LOT & BLK. NO.)",
        "houselotblk": "(HOUSE/LOT & BLK. NO.)",
        "street": "(STREET NAME)",
        "streetname": "(STREET NAME)",
        "barangay": "(BARANGAY/DISTRICT/LOCALITY)",
        "barangaydistrictlocality": "(BARANGAY/DISTRICT/LOCALITY)",
        "city": "(CITY/MUNICIPALITY)",
        "municipality": "(CITY/MUNICIPALITY)",
        "citymunicipality": "(CITY/MUNICIPALITY)",
        "province": "(PROVINCE)",
        "country": "(COUNTRY)",
        "zipcode": "ZIP CODE",
        "postalcode": "ZIP CODE",
        "contactnumber": "MOBILE/CELLPHONE NUMBER",
        "mobilenumber": "MOBILE/CELLPHONE NUMBER",
        "mobilecellphonenumber": "MOBILE/CELLPHONE NUMBER",
        "cellphonenumber": "MOBILE/CELLPHONE NUMBER",
        "telephonenumber": "TELEPHONE NUMBER",
        "phonenumber": "TELEPHONE NUMBER",
        "email": "E-MAIL ADDRESS",
        "emailaddress": "E-MAIL ADDRESS",

        "sex": {
            "type": "checkbox",
            "options": {"male": "Male", "female": "Female"},
        },
        "civilstatus": {
            "type": "checkbox",
            "options": {
                "single": "Single",
                "married": "Married",
                "legallyseparated": "Legally Separated",
                "widowwidower": "Widow/Widower",
                "widow": "Widow/Widower",
                "annulled": "Annulled",
            },
        },
    },
    "philhealth_pmrf": {
        "philhealth": "PHILHEALTH IDENTIFICATION NUMBER",
        "philhealthnumber": "PHILHEALTH IDENTIFICATION NUMBER",
        "lastname": "LAST NAME",
        "surname": "LAST NAME",
        "firstname": "FIRST NAME",
        "middlename": "MIDDLE NAME",
    },
    "pagibig_mdf": {
        "pagibigmidno": "PAG-IBIG MID NO",
        "pagibignumber": "PAG-IBIG MID NO",
        "lastname": "LAST NAME",
        "surname": "LAST NAME",
        "firstname": "FIRST NAME",
        "givenname": "FIRST NAME",
        "middlename": "MIDDLE NAME",
        "nameextension": "NAME EXTENSION",
        "suffix": "NAME EXTENSION",
        "mothersmaidenname": "MOTHER'S MAIDEN NAME",
        "fathersname": "FATHER'S NAME",
        "spousename": "SPOUSE'S NAME",
        "dateofbirth": "DATE OF BIRTH",
        "birthdate": "DATE OF BIRTH",
        "placeofbirth": "PLACE OF BIRTH",
        "tin": "TAX IDENTIFICATION NUMBER",
        "taxpayerid": "TAX IDENTIFICATION NUMBER",
        "sssgisissnumber": "SSS/GSIS NUMBER",
        "sssnumber": "SSS/GSIS NUMBER",
        "province": "PROVINCE",
        "city": "CITY/MUNICIPALITY",
        "barangay": "BARANGAY",
        "zipcode": "ZIP CODE",
        "cellphonenumber": "CELL PHONE NUMBER",
        "mobilenumber": "CELL PHONE NUMBER",
        "emailaddress": "EMAIL ADDRESS",
        "sex": {
            "type": "checkbox",
            "options": {"male": "Male", "female": "Female"}
        },
        "civilstatus": {
            "type": "checkbox",
            "options": {
                "single": "Single",
                "married": "Married",
                "widowed": "Widow/er",
                "annulled": "Annulled/Legally Separated",
                "legallyseparated": "Annulled/Legally Separated"
            }
        }
    }
}

# --- BIR Form 1701A (Annual Income Tax Return) ---
#
# This form is deliberately mapped to a SMALLER field set than SSS E-1/
# PhilHealth/Pag-IBIG, since 1701A only needs taxpayer identification,
# taxpayer type, and Alphanumeric Tax Code (ATC) selection stamped on it.
_BIR_1701A_ANCHORS = {
    # ------------------------------------------------------------------
    # NOTE: The original file this was copied/pasted from was truncated
    # right here — everything above "civilstatus" below (e.g. tin,
    # rdocode, registerdname, line of business anchors) was lost, and
    # only the tail end of one checkbox-style field survived (the two
    # stray "}," lines that used to close it). I've restored a
    # syntactically valid placeholder for that field below (guessed as
    # "civilstatus" based on indentation/shape matching the other forms'
    # civil-status checkboxes) — but you should verify this against the
    # real anchor text printed on your 1701A PDF and replace it, and
    # re-add whatever other fields (TIN, RDO code, etc.) were lost.
    # ------------------------------------------------------------------
    "civilstatus": {
        "type": "checkbox",
        "page": 0,
        "options": {
            "single": "Single",
            "married": "Married",
            "widowwidower": "Widow/Widower",
            "widow": "Widow/Widower",
            "legallyseparated": "Legally Separated",
        },
    },
    "taxpayertype": {
        "type": "checkbox",
        "page": 0,
        "options": {
            "singleproprietor": "Single Proprietor",
            "professional": "Professional",
        },
    },
    "atc": {
        "type": "checkbox",
        "page": 0,
        "options": {
            "businessincomegraduateditrates": "Business Income - Graduated IT Rates",
            "incomefromprofessiongraduateditrates": "Income from Profession \u2013 Graduated IT Rates",
            "businessincome8itrate": "Business Income - 8% IT Rate",
            "incomefromprofession8itrate": "Income from Profession \u2013 8% IT Rate",
        },
    },
}

ANCHOR_MAPS["bir_1701a"] = _BIR_1701A_ANCHORS
ANCHOR_MAPS["bir_1701"] = _BIR_1701A_ANCHORS
ANCHOR_MAPS["bir_1701_1701a"] = _BIR_1701A_ANCHORS

CHECKBOX_MARK_OFFSET_X = 12
CHECKBOX_MARK_OFFSET_Y = 0

def _normalize(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", key.lower())

def _leaf_field(field_name: str) -> str:
    without_index = re.sub(r"\[\d+\]", "", field_name)
    return without_index.split(".")[-1] if "." in without_index else without_index

class PDFGeneratorService:
    @staticmethod
    def fill_pdf(
        original_file_bytes: bytes,
        fill_data: list[dict],
        form_type: str,
        filename: str = "document.pdf",
    ) -> tuple[bytes, list[str]]:
        skipped_fields: list[str] = []
        try:
            if form_type not in ANCHOR_MAPS:
                raise ValueError(
                    f"No anchor map is configured for form_type='{form_type}'. "
                    "This form type isn't supported for auto-fill yet."
                )

            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                ext = filename.split('.')[-1].lower()
                if ext == "jpg":
                    ext = "jpeg"
                img_doc = fitz.open(stream=original_file_bytes, filetype=ext)
                pdf_bytes = img_doc.convert_to_pdf()
                doc = fitz.open("pdf", pdf_bytes)
            else:
                doc = fitz.open(stream=original_file_bytes, filetype="pdf")

            anchors = ANCHOR_MAPS.get(form_type, {})
            ocr_textpage_cache: dict[int, object | None] = {}

            def get_ocr_textpage(page_idx: int, page):
                if page_idx not in ocr_textpage_cache:
                    try:
                        ocr_textpage_cache[page_idx] = page.get_textpage_ocr(dpi=150, full=True)
                    except Exception as ocr_err:
                        logger.warning(f"OCR fallback failed on page {page_idx}: {ocr_err}")
                        ocr_textpage_cache[page_idx] = None
                return ocr_textpage_cache[page_idx]

            for item in fill_data:
                field_name = str(item.get("field_name", ""))
                text_to_insert = str(item.get("text", "")).strip()

                if not text_to_insert or text_to_insert.lower() in ("null", "undefined", "none", "[object object]"):
                    continue

                leaf = _leaf_field(field_name)
                anchor_entry = anchors.get(_normalize(leaf))

                # --- FIX: Fallback lookup for un-stripped keys ---
                if not anchor_entry:
                    normalized_leaf = _normalize(leaf)
                    partial_key = next((k for k in anchors.keys() if k in normalized_leaf and len(k) > 5), None)
                    if partial_key:
                        anchor_entry = anchors[partial_key]
                    else:
                        continue

                if not anchor_entry:
                    continue

                if _normalize(leaf) in ("birthdate", "dateofbirth"):
                    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", text_to_insert)
                    slash_match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", text_to_insert)
                    if iso_match:
                        year, month, day = iso_match.groups()
                        text_to_insert = f"{month} {day} {year}"
                    elif slash_match:
                        month, day, year = slash_match.groups()
                        text_to_insert = f"{month} {day} {year}"

                is_checkbox = isinstance(anchor_entry, dict) and anchor_entry.get("type") == "checkbox"

                page_hint = None
                extra_dx = 0.0
                extra_dy = 0.0
                if is_checkbox:
                    page_hint = anchor_entry.get("page")
                elif isinstance(anchor_entry, dict):
                    page_hint = anchor_entry.get("page")
                    extra_dx = anchor_entry.get("dx", 0.0)
                    extra_dy = anchor_entry.get("dy", 0.0)

                if is_checkbox:
                    option_anchor = anchor_entry["options"].get(_normalize(text_to_insert))
                    if not option_anchor:
                        logger.warning(
                            f"Checkbox field '{field_name}' has unrecognized value "
                            f"'{text_to_insert}'; no matching option, skipped."
                        )
                        skipped_fields.append(field_name)
                        continue
                    search_text = option_anchor
                    mark_text = "X"
                elif isinstance(anchor_entry, dict):
                    search_text = anchor_entry["anchor"]
                    mark_text = text_to_insert
                else:
                    search_text = anchor_entry
                    mark_text = text_to_insert

                page_range = [page_hint] if page_hint is not None else range(len(doc))

                stamped = False
                for page_idx in page_range:
                    if page_idx >= len(doc):
                        continue
                    page = doc[page_idx]

                    rects = page.search_for(search_text)

                    if not rects and hasattr(page, "get_textpage_ocr"):
                        ocr_textpage = get_ocr_textpage(page_idx, page)
                        if ocr_textpage is not None:
                            rects = page.search_for(search_text, textpage=ocr_textpage)

                    if rects:
                        anchor_rect = rects[0]

                        if is_checkbox:
                            target_x = anchor_rect.x0 - CHECKBOX_MARK_OFFSET_X
                            target_y = anchor_rect.y1 + CHECKBOX_MARK_OFFSET_Y
                            probe_rect = fitz.Rect(
                                target_x - 2, anchor_rect.y0, anchor_rect.x0, anchor_rect.y1
                            )
                        else:
                            target_x = anchor_rect.x0
                            target_y = anchor_rect.y1 + 14
                            probe_rect = fitz.Rect(
                                target_x, anchor_rect.y1, anchor_rect.x1, target_y + 12
                            )

                        if not is_checkbox:
                            target_x += extra_dx
                            target_y += extra_dy
                            if extra_dx or extra_dy:
                                probe_rect = fitz.Rect(
                                    target_x, target_y - 12, target_x + 150, target_y + 4
                                )

                        existing_text = page.get_text("text", clip=probe_rect).strip()
                        if existing_text:
                            logger.warning(
                                f"Skipped stamping '{field_name}': target area already "
                                f"has content ('{existing_text[:30]}'), avoiding overlap."
                            )
                            skipped_fields.append(field_name)
                            stamped = True
                            break

                        page.insert_text(
                            fitz.Point(target_x, target_y),
                            mark_text,
                            fontsize=9,
                            fontname="helv",
                            color=(0.1, 0.1, 0.4),  # dark blue ink
                        )
                        stamped = True
                        break

                if not stamped:
                    logger.warning(
                        f"No anchor match for field '{field_name}' (form_type={form_type}); skipped stamping "
                        "rather than guessing a position."
                    )
                    skipped_fields.append(field_name)

            output_stream = io.BytesIO()
            doc.save(output_stream)
            doc.close()

            return output_stream.getvalue(), skipped_fields

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Anchor-based PDF mapping failed: {e}")
            raise ValueError(f"Failed to dynamically process and stamp document: {str(e)}")