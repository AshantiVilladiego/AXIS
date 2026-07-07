# fixed_prompts.py
# Canned prompt/answer table for the AXIS government-form assistant.
# Content is grounded in official BIR / SSS / PhilHealth / Pag-IBIG form
# instructions (not third-party blogs) since this is regulated content
# that must not vary across model providers. Treat this file the way
# you'd treat legal copy: changes need a second pair of eyes before merge.

from typing import TypedDict


class FixedAnswer(TypedDict):
    prompt: str
    answer: str


# ---------------------------------------------------------------------------
# Question 1 + 2 share a document selector, since "walk me through this form"
# and "what do I submit with this form" both depend on which form is picked.
# ---------------------------------------------------------------------------

DOCUMENT_LABELS = {
    "bir_2316": "BIR Form 2316",
    "bir_1701_1701a": "BIR Form 1701 / 1701A",
    "sss_e1": "SSS Form E-1",
    "philhealth_pmrf": "PhilHealth PMRF",
    "pagibig_mdf": "Pag-IBIG MDF",
}

WALKTHROUGH_ANSWERS: dict[str, str] = {
    "bir_2316": (
        "Heads up: BIR Form 2316 is prepared by your employer's HR or payroll "
        "team, not by you. Your part is limited to two things — checking the "
        "figures for accuracy, and signing.\n\n"
        "What your employer fills in:\n"
        "1. Part I – Your personal information (name, TIN, address).\n"
        "2. Part II – Employer information.\n"
        "3. Part III – Previous employer's information, only if you changed "
        "jobs within the year and gave them your old 2316.\n"
        "4. Part IV-A – Summary of taxable income and tax due for the year.\n"
        "5. Part IV-B – Itemized breakdown: Section A (non-taxable pay like "
        "basic salary up to the exempt cap, de minimis benefits, SSS/PhilHealth/"
        "Pag-IBIG contributions) and Section B (taxable pay and withholding).\n\n"
        "What you do: verify the entries, then sign Item 54 with your CTC or "
        "valid ID number, date, and place of issue. Your employer signs Item 53. "
        "Since RMC No. 29-2024, your signature is mandatory — unsigned copies "
        "from the pandemic-era exception are no longer accepted."
    ),
    "bir_1701_1701a": (
        "First, confirm which one applies to you — this matters more than the "
        "line-by-line fields:\n"
        "- File 1701A if ALL your income is from business or a profession "
        "(no employer during the year) and you're on Optional Standard "
        "Deduction or the 8% flat rate.\n"
        "- File 1701 if you had any employment income at all during the year "
        "(even one month), or you're on itemized deductions, or you're an "
        "estate/trust.\n\n"
        "Section flow for both forms:\n"
        "1. Background information — TIN, RDO code, registered name and "
        "address, line of business, taken from your BIR Form 2303 (Certificate "
        "of Registration).\n"
        "2. Spouse information, if married and filing jointly — otherwise skip.\n"
        "3. Tax computation schedules — for 1701, this includes a schedule for "
        "compensation income (if mixed income) plus a schedule for business/"
        "profession income under your chosen method; for 1701A, just the "
        "business/profession schedule under OSD or 8%.\n"
        "4. Tax credits — prior 1701Q quarterly payments and any BIR Form 2307 "
        "creditable withholding certificates you received during the year.\n"
        "5. Signature block certifying the return.\n\n"
        "File through eBIRForms or eFPS by April 15. If you have attachments "
        "(2307s, financial statements), those go through the separate eAFS "
        "portal within 15 days after filing — filing the form itself doesn't "
        "cover that step."
    ),
    "sss_e1": (
        "Which parts you fill in depends on why you're registering:\n"
        "- Pre-employment requirement (most first-time applicants, including "
        "students): fill out Parts I-A, I-B, and I-D only.\n"
        "- Self-Employed, OFW, or Non-Working Spouse membership: fill out "
        "Parts I-A, I-B, I-C, and I-D.\n\n"
        "1. Part I-A – Personal Data: full name exactly as on your birth "
        "certificate, date of birth, sex, civil status, TIN if you have one, "
        "nationality, religion, place of birth, complete home address.\n"
        "2. Part I-B – Dependents/Beneficiaries, if you have any to declare. "
        "Use the additional sheet if you run out of space.\n"
        "3. Part I-C – Self-Employed/OFW/Non-Working Spouse section: skip this "
        "entirely if you're registering for a pre-employment requirement.\n"
        "4. Part I-D – Certification: sign, or affix fingerprints in front of "
        "SSS staff if you can't sign.\n\n"
        "Print in capital letters, black ink only, two copies. Write \"N/A\" "
        "on any field that doesn't apply rather than leaving it blank."
    ),
    "philhealth_pmrf": (
        "1. Purpose — check \"Registration\" for a first-time application.\n"
        "2. Preferred KonSulTa provider — pick a primary care facility near "
        "your home or workplace.\n"
        "3. Personal Details — name exactly as on your PSA birth certificate, "
        "mother's maiden name, date/place of birth, sex, civil status, "
        "citizenship. PhilSys ID number and TIN are optional if you have them.\n"
        "4. Address and contact information — permanent home address and "
        "mailing address (if different), plus phone/email.\n"
        "5. Dependents — declare a spouse, children under 21, or parents 60 "
        "and above who are fully dependent on you, if applicable.\n"
        "6. Member Type — select the category that matches your situation "
        "(e.g., employed, self-earning, or a category your HR/school "
        "specifies for the requirement you're completing).\n"
        "7. Signature over printed name, with the date signed.\n\n"
        "Write in capital letters and use \"N/A\" for anything that doesn't apply."
    ),
    "pagibig_mdf": (
        "1. Personal information — full name, date/place of birth, sex, "
        "height, weight, marital status, citizenship.\n"
        "2. Occupational status — if you're completing this for a "
        "pre-employment requirement and don't have a job yet, select "
        "\"Unemployed/Not Yet Employed.\" Only fill in the present employment "
        "fields (employer name, address, employee number) if you're currently "
        "employed.\n"
        "3. Present and permanent home address, plus your preferred mailing "
        "address if different.\n"
        "4. Previous employment / prior Pag-IBIG membership history, if any.\n"
        "5. Heirs — name your legal heirs in case of death; this follows the "
        "New Civil Code rules on succession. Use an extra sheet if needed.\n"
        "6. Certification — sign and date.\n\n"
        "Print in block/capital letters, one copy only. Note that registering "
        "with Pag-IBIG does not by itself qualify you for their loan programs — "
        "that's a separate eligibility process."
    ),
}

SUPPORTING_DOCS_ANSWERS: dict[str, str] = {
    "bir_2316": (
        "The 2316 itself isn't submitted with attachments when your employer "
        "issues it to you — it's a certificate they hand to you, not a form "
        "you file. You'd only need ID if you're requesting a copy from a "
        "previous employer directly (bring a valid ID to make the request), "
        "or if a third party (bank, school, embassy) asks for your 2316 "
        "alongside other proof like a valid government ID — check with "
        "whoever is requesting it, since that requirement comes from them, "
        "not from BIR."
    ),
    "bir_1701_1701a": (
        "Have ready: your TIN and BIR Certificate of Registration (Form 2303), "
        "BIR Form 2307 (creditable withholding tax certificates) for any "
        "income already taxed at source, proof of your prior 1701Q quarterly "
        "payments for the year, and — if required for your registration type "
        "— financial statements. These 2307s and financial statements are "
        "uploaded separately through BIR's eAFS portal after you file, not "
        "attached to the 1701/1701A form itself."
    ),
    "sss_e1": (
        "Submit ONE of these primary IDs (original or certified true copy, "
        "photocopy attached): PSA birth certificate, passport, UMID, driver's "
        "license, PRC card, or Seaman's Book.\n\n"
        "If you don't have any of those, submit TWO secondary documents "
        "instead, both showing your correct name and at least one showing "
        "your date of birth — e.g., School ID, NBI clearance, Baptismal "
        "certificate, Police clearance, Postal ID, or a Student Permit from LTO."
    ),
    "philhealth_pmrf": (
        "First-time registrants: one valid proof of identity (government-"
        "issued ID) plus your PSA birth certificate to confirm your legal "
        "name and birth details.\n\n"
        "If you're declaring dependents, add documents proving the "
        "relationship — marriage certificate for a spouse, birth certificates "
        "for children or parents."
    ),
    "pagibig_mdf": (
        "One valid government-issued ID is generally sufficient for first-time "
        "MDF registration. If you're currently employed, be ready with your "
        "employer's name and address to complete the employment section — no "
        "separate document is required for that, since it's just information "
        "you fill in. Note that MDF registration alone doesn't require proof "
        "of income; that only comes up later if you apply for a specific "
        "loan program."
    ),
}


WALKTHROUGH_PROMPT: FixedAnswer = {
    "prompt": "Can you walk me through how to fill out this form section by section?",
    "answer": "",  # resolved at request time via WALKTHROUGH_ANSWERS[document_key]
}

SUPPORTING_DOCS_PROMPT: FixedAnswer = {
    "prompt": "What required ID cards or supporting documents do I need to submit along with this completed form?",
    "answer": "",  # resolved at request time via SUPPORTING_DOCS_ANSWERS[document_key]
}

# ---------------------------------------------------------------------------
# Question 3 stands alone — it's specific to the SSS E-1 form.
# ---------------------------------------------------------------------------

SSS_PROFESSION_BUSINESS_PROMPT: FixedAnswer = {
    "prompt": (
        "What should I write under the 'Profession/Business' section in the "
        "SSS E-1 form if I am a graduating student applying for a "
        "pre-employment requirement?"
    ),
    "answer": (
        "Leave it blank, or mark it N/A — you don't fill this section out at "
        "all in your case.\n\n"
        "The 'Profession/Business' field lives in Part I-C, which only applies "
        "to applicants registering as Self-Employed, an OFW, or a Non-Working "
        "Spouse. Since you're getting your SS number as a pre-employment "
        "requirement, you only accomplish Parts I-A, I-B, and I-D — Part I-C "
        "isn't part of your application at all.\n\n"
        "'Profession/Business' in this context specifically means a trade or "
        "occupation you personally run for income, for SSS contribution "
        "purposes — not your student status, and not the job you're about to "
        "apply for. Being a graduating student doesn't require you to enter "
        "anything there."
    ),
}


FIXED_PROMPTS = {
    "walkthrough": WALKTHROUGH_PROMPT,
    "supporting_docs": SUPPORTING_DOCS_PROMPT,
    "sss_profession_business": SSS_PROFESSION_BUSINESS_PROMPT,
}


def get_fixed_answer(prompt_key: str, document_key: str | None = None) -> str:
    """
    Returns the canned answer text for a fixed-prompt button click.
    document_key is required for 'walkthrough' and 'supporting_docs'
    (one of the keys in DOCUMENT_LABELS); ignored otherwise.
    """
    if prompt_key == "walkthrough":
        return WALKTHROUGH_ANSWERS[document_key]
    if prompt_key == "supporting_docs":
        return SUPPORTING_DOCS_ANSWERS[document_key]
    if prompt_key == "sss_profession_business":
        return SSS_PROFESSION_BUSINESS_PROMPT["answer"]
    raise KeyError(f"Unknown fixed prompt key: {prompt_key}")