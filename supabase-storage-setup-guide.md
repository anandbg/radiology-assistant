# Supabase Storage Setup Guide

## Issue: Permission Error (42501)

The error "must be owner of table objects" means you need **admin/service role** permissions to create storage policies. The anon key can't modify table policies.

## ✅ **Solution: Use Supabase Dashboard UI**

### **Step 1: Create Storage Bucket**

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/bgflncjuynahdrkieqak

2. Click **"Storage"** in left sidebar

3. Click **"New Bucket"** button

4. Configure:
   - **Name**: `audiobucket`
   - **Public bucket**: ✅ **ENABLE THIS** (Very important!)
   - **File size limit**: 50MB (optional)
   - **Allowed MIME types**: Leave empty or add `audio/*`

5. Click **"Create bucket"**

### **Step 2: Configure Bucket Policies (Via Dashboard)**

**Option A: Use the Dashboard UI (Recommended)**

1. In **Storage** section, find your `audiobucket`

2. Click the **"Settings"** icon (gear) next to `audiobucket`

3. Go to **"Policies"** tab

4. Click **"Add Policy"**

5. Create these policies:

   **Policy 1: Allow Upload**
   - **Policy Name**: `Enable upload for audiobucket`
   - **Allowed Operation**: `INSERT`
   - **Target Roles**: `public` (or `anon` if available)
   - **Policy Definition**: 
     ```sql
     bucket_id = 'audiobucket'
     ```

   **Policy 2: Allow Download**  
   - **Policy Name**: `Enable download for audiobucket`
   - **Allowed Operation**: `SELECT`
   - **Target Roles**: `public` (or `anon` if available)
   - **Policy Definition**:
     ```sql
     bucket_id = 'audiobucket'
     ```

**Option B: Use SQL Editor with Admin Account**

If you have admin access to your Supabase project:

1. Go to **SQL Editor**
2. Click **"New Query"**  
3. Paste this SQL:

```sql
-- Make sure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('audiobucket', 'audiobucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policies for public access
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audiobucket');

CREATE POLICY "Public Download" ON storage.objects  
FOR SELECT USING (bucket_id = 'audiobucket');

CREATE POLICY "Public Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'audiobucket');

CREATE POLICY "Public Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'audiobucket');
```

### **Step 3: Test the Setup**

After creating the bucket and policies, test it:

```bash
cd /home/user/webapp && node scripts/test-supabase-storage.js
```

### **Step 4: Verify File Upload Works**

Test the actual file upload endpoint:

```bash
cd /home/user/webapp
echo "Test audio data" > /tmp/test-audio.txt
curl -X POST -F "file=@/tmp/test-audio.txt" http://localhost:3000/api/files/upload
```

You should see a success response with file URL.

## 🔍 **Alternative: Check Current Permissions**

If you want to see what permissions your anon key has:

```bash
# Test what the anon key can access
cd /home/user/webapp && node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.storage.listBuckets().then(({data, error}) => console.log('Buckets:', data, 'Error:', error));
"
```

## 🎯 **Expected Success Result**

Once properly configured, you should see:

```json
{
  "file_key": "1/1/1724245123456-abc123.txt",
  "url": "https://bgflncjuynahdrkieqak.supabase.co/storage/v1/object/public/audiobucket/1/1/1724245123456-abc123.txt",
  "attachment": {
    "name": "test-audio.txt",
    "type": "text/plain",
    "size": 16,
    "url": "...",
    "r2_key": "1/1/1724245123456-abc123.txt"
  },
  "storage_type": "supabase"
}
```

## 🚨 **If You Still Get Permission Errors**

1. **Check if you're the project owner** - Only owners can modify storage policies
2. **Use service role key** - If you have it, temporarily use it for setup
3. **Create new project** - As a last resort, create a fresh Supabase project where you're the owner

The dashboard UI approach should work even with limited permissions since it uses the web interface with your logged-in credentials rather than API keys.