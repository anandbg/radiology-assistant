import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSupabaseStorage() {
  console.log('🔍 Testing Supabase Storage setup...\n')
  
  try {
    // List all buckets
    console.log('📁 Listing storage buckets...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message)
    } else {
      console.log('✅ Available buckets:')
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.id} (public: ${bucket.public})`)
      })
    }
    
    // Check if audiobucket exists
    console.log('\n🎵 Checking audiobucket...')
    const audioBucket = buckets?.find(b => b.id === 'audiobucket')
    
    if (!audioBucket) {
      console.log('⚠️  audiobucket not found in bucket list')
      console.log('💡 Try creating it via Supabase Dashboard > Storage > New Bucket')
    } else {
      console.log(`✅ audiobucket found (public: ${audioBucket.public})`)
      
      // Try to list files in audiobucket
      console.log('\n📋 Listing files in audiobucket...')
      const { data: files, error: filesError } = await supabase.storage
        .from('audiobucket')
        .list()
      
      if (filesError) {
        console.error('❌ Error listing files:', filesError.message)
        console.log('💡 This might be due to RLS policies - check supabase-storage-policies.sql')
      } else {
        console.log(`✅ Successfully accessed audiobucket (${files.length} files)`)
      }
    }
    
    // Test upload with a small text file
    console.log('\n🧪 Testing file upload...')
    const testContent = new Blob(['Hello from Supabase Storage test!'], { type: 'text/plain' })
    const testFileName = `test-${Date.now()}.txt`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audiobucket')
      .upload(`1/1/${testFileName}`, testContent, {
        contentType: 'text/plain'
      })
    
    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError.message)
      
      if (uploadError.message.includes('row-level security policy')) {
        console.log('\n🔧 RLS Policy Issue Detected!')
        console.log('Please run the SQL commands in supabase-storage-policies.sql:')
        console.log('1. Go to Supabase Dashboard > SQL Editor')
        console.log('2. Run: cat supabase-storage-policies.sql')
        console.log('3. Paste and execute the SQL commands')
      } else if (uploadError.message.includes('Bucket not found')) {
        console.log('\n🪣 Bucket Missing!')
        console.log('Please create the audiobucket:')
        console.log('1. Go to Supabase Dashboard > Storage')
        console.log('2. Click "New Bucket"')
        console.log('3. Name: audiobucket')
        console.log('4. Make it Public: ✅')
      }
    } else {
      console.log('✅ Upload test successful!')
      console.log(`   File: ${uploadData.path}`)
      
      // Test getting public URL
      const { data: urlData } = supabase.storage
        .from('audiobucket')
        .getPublicUrl(uploadData.path)
      
      console.log(`   URL: ${urlData.publicUrl}`)
      
      // Clean up test file
      await supabase.storage.from('audiobucket').remove([uploadData.path])
      console.log('   (Test file cleaned up)')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

async function main() {
  console.log('🚀 Supabase Storage Test\n')
  
  await testSupabaseStorage()
  
  console.log('\n✅ Test complete!')
  console.log('\n🎯 Next steps if upload failed:')
  console.log('1. Ensure audiobucket exists and is public')
  console.log('2. Run the SQL policies: cat supabase-storage-policies.sql')
  console.log('3. Test again: node scripts/test-supabase-storage.js')
}

main().catch(console.error)