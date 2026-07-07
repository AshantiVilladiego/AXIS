from typing import Optional, Dict, Any

def get_fixed_answer(prompt_type: str, document_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns a pre-written, expert response for specific, high-frequency user questions.
    Returns a dictionary with 'reply' (string) and 'steps' (list of strings).
    """

    # 1. SSS Profession vs Business (No document key required)
    if prompt_type == "sss_profession_business":
        return {
            "reply": "When registering with SSS as self-employed, choosing between 'Profession' and 'Business' depends on how you earn your income:",
            "steps": [
                "Profession: Select this if you are a freelancer, licensed professional (e.g., doctor, engineer, CPA), or offer specialized services based on your personal skills.",
                "Business: Select this if you own a registered enterprise (like a sari-sari store, trading company, or manufacturing) that sells goods or services, usually requiring a DTI or SEC registration."
            ]
        }

    # 2. Walkthroughs (How to fill out a specific form)
    if prompt_type == "walkthrough":
        walkthroughs = {
            "bir_2316": {
                "reply": "Here is a quick guide to understanding and verifying your BIR Form 2316 (Certificate of Compensation Payment/Tax Withheld):",
                "steps": [
                    "Check Part I (Employee Information): Ensure your TIN, Name, and Address are perfectly accurate.",
                    "Check Part II (Employer Information): Verify that your employer's details and TIN are correct.",
                    "Review Part IV (Summary): Look at 'Gross Compensation Income' and ensure it matches your total annual pay.",
                    "Check 'Tax Withheld': This is the amount your employer already remitted to the BIR on your behalf.",
                    "Sign at the bottom: If your employer qualifies you for substituted filing, sign the declaration at the bottom."
                ]
            },
            "bir_1701": {
                "reply": "Here is a high-level walkthrough for BIR Form 1701/1701A (Annual Income Tax Return for Individuals):",
                "steps": [
                    "Select the correct form: Use 1701A if you opted for the 8% flat rate or OSD. Use 1701 if you are claiming itemized deductions or have mixed income.",
                    "Fill in Background Info: Provide your TIN, RDO code, and personal details.",
                    "Declare Gross Sales/Receipts: Enter your total earnings for the taxable year before any deductions.",
                    "Compute Deductions: Subtract your allowable deductions (if using OSD, it's an automatic 40% deduction).",
                    "Calculate Tax Due: Apply the tax rates based on your chosen method (8% or graduated rates).",
                    "Deduct Tax Credits: Subtract any taxes already withheld (supported by Form 2307)."
                ]
            },
            "sss_e1": {
                "reply": "Here is how to fill out SSS Form E-1 (Personal Record) for first-time registrants:",
                "steps": [
                    "Part I (Personal Data): Fill in your name, birth details, sex, and civil status exactly as they appear on your Birth Certificate.",
                    "Address and Contact: Provide your permanent address, email, and active mobile number.",
                    "Part II (Beneficiaries): List your legal spouse and legitimate/illegitimate children. If single, list your parents.",
                    "Part III (Dependents): Only applicable if you have minor children or incapacitated parents.",
                    "Sign and Date: Affix your signature and thumbmarks (left and right) in the presence of the SSS receiving personnel."
                ]
            },
            "philhealth_pmrf": {
                "reply": "Here is a guide to filling out the PhilHealth Member Registration Form (PMRF):",
                "steps": [
                    "Purpose: Check 'Registration' if this is your first time, or 'Updating' if you are changing details.",
                    "Member Category: Select your correct category (e.g., Formal Economy for employed, Informal Economy for self-employed/freelancers).",
                    "Personal Details: Write your name, mother's maiden name, and spouse details (if applicable).",
                    "Dependents: List your legal spouse, children under 21, and parents aged 60 and above (they will be covered for free).",
                    "Declaration: Sign and date the back page to certify that the information is true and correct."
                ]
            },
            "pagibig_mdf": {
                "reply": "Here is how to fill out the Pag-IBIG Member's Data Form (MDF):",
                "steps": [
                    "Member Info: Fill in your Last Name, First Name, Name Extension (if any), and Middle Name.",
                    "Mother's Maiden Name: This is crucial for account recovery and verification.",
                    "Employment Details: If employed, provide your company's name and address. If self-employed, leave the employer section blank or put your business name.",
                    "Heirs/Beneficiaries: List the people who will receive your savings in case of death.",
                    "Certification: Sign the bottom part to attest to the accuracy of your details."
                ]
            }
        }
        
        # Return the specific document walkthrough, or a fallback if not found
        return walkthroughs.get(document_key, {
            "reply": "Please select a specific document to get a step-by-step walkthrough.",
            "steps": []
        })

    # 3. Supporting Documents (What do I need to bring?)
    if prompt_type == "supporting_docs":
        docs = {
            "bir_2316": {
                "reply": "BIR Form 2316 is usually provided by your employer. If you need to submit it to a new employer, just bring:",
                "steps": [
                    "The original signed copy of your Form 2316 from your previous employer.",
                    "Photocopies of the form for your new HR department."
                ]
            },
            "bir_1701": {
                "reply": "When filing your BIR Form 1701/1701A, you should prepare the following supporting documents:",
                "steps": [
                    "Certificate of Income Tax Withheld at Source (BIR Form 2307), if applicable.",
                    "Certificate of Compensation Payment/Tax Withheld (BIR Form 2316), if you have mixed income.",
                    "Duly approved Tax Debit Memo, if applicable.",
                    "Proof of prior year's excess tax credits, if applicable.",
                    "Account Information Form (AIF) or Audited Financial Statements, if your gross sales exceed 3 million PHP."
                ]
            },
            "sss_e1": {
                "reply": "To register using the SSS Form E-1, you must bring the original/certified true copy and a photocopy of ANY of the following primary documents:",
                "steps": [
                    "PSA/NSO Birth Certificate",
                    "Valid Passport",
                    "Driver's License",
                    "PRC Card",
                    "Seaman's Book"
                ]
            },
            "philhealth_pmrf": {
                "reply": "When submitting your PhilHealth PMRF, bring the following supporting documents:",
                "steps": [
                    "Two (2) copies of the accomplished PMRF.",
                    "Two (2) latest 1x1 ID pictures.",
                    "Photocopy of PSA Birth Certificate or two (2) valid IDs.",
                    "For declaring dependents: Photocopy of Marriage Contract (for spouse) or Birth Certificate (for children/parents)."
                ]
            },
            "pagibig_mdf": {
                "reply": "When registering for a Pag-IBIG MID Number using the MDF, prepare the following:",
                "steps": [
                    "Printed copy of the accomplished Member's Data Form (MDF).",
                    "At least two (2) valid primary IDs (e.g., Passport, Driver's License, UMID, Voter's ID).",
                    "If registering purely online, the system will generate your RTN (Registration Tracking Number) immediately without needing to submit physical docs."
                ]
            }
        }
        
        return docs.get(document_key, {
            "reply": "Please select a specific document to see the required supporting documents.",
            "steps": []
        })

    # Fallback for unrecognized prompts
    return {
        "reply": "I'm sorry, I don't have pre-written information for that specific request yet.",
        "steps": []
    }