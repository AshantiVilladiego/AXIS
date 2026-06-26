-- 1. Enable UUID Extension (Standard for unique identification)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the Profiles Table (Links to Supabase Auth & Enforces Valid ID Formats)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    birth_date DATE,
    address TEXT,
    contact_number TEXT,
    taxpayer_id TEXT,
    sss_number TEXT,
    philhealth_number TEXT,
    pagibig_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restrictions (Data Validation Constraints)
    CONSTRAINT valid_birth_date CHECK (birth_date >= '1900-01-01' AND birth_date <= CURRENT_DATE),
    CONSTRAINT valid_email_format CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
    CONSTRAINT valid_sss CHECK (sss_number ~* '^[0-9]{2}-?[0-9]{7}-?[0-9]{1}$'),
    CONSTRAINT valid_philhealth CHECK (philhealth_number ~* '^[0-9]{2}-?[0-9]{9}-?[0-9]{1}$'),
    CONSTRAINT valid_pagibig CHECK (pagibig_number ~* '^[0-9]{4}-?[0-9]{4}-?[0-9]{4}$')
);

-- 3. Create the Forms Table (Tracks user-uploaded files)
CREATE TABLE forms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create the Extracted Fields Table (Holds data pulled by the AI pipeline)
CREATE TABLE extracted_fields (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    field_name TEXT NOT NULL,
    extracted_value TEXT,
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create the Generated Documents Table (Holds output PDFs)
CREATE TABLE generated_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    output_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create the Processing Logs Table (Tracks model usage, fallbacks, and errors)
CREATE TABLE processing_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
    provider_used TEXT,
    processing_status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Turn on Row-Level Security (RLS) for absolute safety
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- 8. Add Security Policies (The "Bouncers" ensuring users only see their own data)
CREATE POLICY "Users can manage own profile" ON profiles 
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own forms" ON forms 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own extracted fields" ON extracted_fields 
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM forms WHERE forms.id = extracted_fields.form_id AND forms.user_id = auth.uid()
    ));

CREATE POLICY "Users can view own documents" ON generated_documents 
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM forms WHERE forms.id = generated_documents.form_id AND forms.user_id = auth.uid()
    ));