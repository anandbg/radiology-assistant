-- Supabase Storage Policies for audiobucket
-- Run this in the Supabase SQL Editor to enable file uploads

-- Allow public uploads to audiobucket (for demo purposes)
-- In production, you'd want more restrictive policies based on authenticated users

INSERT INTO storage.buckets (id, name, public)
VALUES ('audiobucket', 'audiobucket', true)
ON CONFLICT (id) DO UPDATE SET
    public = true;

-- Allow anyone to upload files to audiobucket (for demo)
CREATE POLICY "Enable upload for audiobucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audiobucket');

-- Allow anyone to read files from audiobucket (since it's public)
CREATE POLICY "Enable read for audiobucket" ON storage.objects
FOR SELECT USING (bucket_id = 'audiobucket');

-- Allow users to update their own files (optional)
CREATE POLICY "Enable update for audiobucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'audiobucket');

-- Allow users to delete their own files (optional)  
CREATE POLICY "Enable delete for audiobucket" ON storage.objects
FOR DELETE USING (bucket_id = 'audiobucket');

-- For more secure production setup, you could use policies like:
-- CREATE POLICY "Enable upload for authenticated users" ON storage.objects
-- FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audiobucket');

-- Enable RLS on storage.objects (should already be enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;