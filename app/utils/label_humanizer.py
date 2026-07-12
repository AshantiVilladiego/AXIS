# Manual overrides for keys that don't clean up well from mechanical
# title-casing. Keys are matched first against the full technical key,
# then against just the leaf segment (the part after the last '.'),
# so this dict works whether the caller passes "sss_number" or
# "part_ii.contact_info.sss_number".
MANUAL_OVERRIDES = {
    "sss_number": "SSS Number",
    "mobile_number": "Mobile Number",
    "mobile_cellphone_number": "Mobile Number",
    "tax_identification_number": "Tax ID (TIN)",
    "zip_code": "ZIP Code",
    "tin": "Tax ID (TIN)",
}


def humanize_field(technical_key: str) -> str:
    """Convert a technical extraction key into a friendly question label.

    Extraction keys are flattened with '.' as the nesting separator
    (see document_service._flatten), e.g. "part_i.name.last_name".
    The human-relevant part is the *leaf* segment ("last_name") — not
    the top-level section ("part_i") and not just the final underscore
    token ("name"), which is what an earlier version of this function
    mistakenly returned (collapsing both "first_name" and "last_name"
    down to "Name").
    """
    if technical_key in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[technical_key]

    # Isolate the leaf field, dropping any parent/section prefixes.
    leaf = technical_key.split(".")[-1]

    if leaf in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[leaf]

    return leaf.replace("_", " ").title()