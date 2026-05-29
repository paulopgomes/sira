-- Migration to add logo_url and cnpj to units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Update RLS policies for storage if needed
-- Assuming the bucket 'images' was created manually
-- These policies ensure that anyone can upload and view images in the 'images' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'images');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'images');
