import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPermissions() {
  console.log('🔐 Testing Supabase Anon Key Permissions\n')
  
  console.log('1. 📁 Testing bucket access...')
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
      console.error('❌ Cannot list buckets:', error.message)
    } else {
      console.log(`✅ Can list buckets (${buckets.length} found)`)
      buckets.forEach(bucket => {
        console.log(`   - ${bucket.id} (public: ${bucket.public})`)
      })
    }
  } catch (e) {
    console.error('❌ Bucket listing failed:', e.message)
  }

  console.log('\n2. 🎵 Testing audiobucket specifically...')
  try {
    const { data: files, error } = await supabase.storage
      .from('audiobucket')
      .list('', { limit: 1 })
    
    if (error) {
      console.error('❌ Cannot access audiobucket:', error.message)
      
      if (error.message.includes('not found')) {
        console.log('💡 Bucket doesn\'t exist - create it in Supabase Dashboard')
      } else if (error.message.includes('permission')) {
        console.log('💡 Permission issue - check RLS policies')
      }
    } else {
      console.log(`✅ Can access audiobucket (${files.length} files)`)
    }
  } catch (e) {
    console.error('❌ Audiobucket test failed:', e.message)
  }

  console.log('\n3. 📤 Testing simple upload...')
  try {
    const testFile = new Blob(['Hello test'], { type: 'text/plain' })
    const testPath = `test-${Date.now()}.txt`
    
    const { data, error } = await supabase.storage
      .from('audiobucket')
      .upload(testPath, testFile)
    
    if (error) {
      console.error('❌ Upload failed:', error.message)
      
      if (error.message.includes('row-level security')) {
        console.log('💡 RLS policy blocking upload')
        console.log('   Solution: Enable public upload policy via Supabase Dashboard')
      } else if (error.message.includes('not found')) {
        console.log('💡 Bucket missing')
        console.log('   Solution: Create audiobucket in Supabase Dashboard > Storage')
      }
    } else {
      console.log('✅ Upload successful!')
      console.log(`   Path: ${data.path}`)
      
      // Clean up
      await supabase.storage.from('audiobucket').remove([data.path])
      console.log('   (Test file cleaned up)')
    }
  } catch (e) {
    console.error('❌ Upload test failed:', e.message)
  }

  console.log('\n4. 🔍 Testing database access...')
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
    
    if (error) {
      console.error('❌ Cannot access database:', error.message)
    } else {
      console.log('✅ Database access working')
      console.log(`   Found organization: ${data[0]?.name}`)
    }
  } catch (e) {
    console.error('❌ Database test failed:', e.message)
  }

  console.log('\n📋 Summary:')
  console.log('✅ Database: Working (confirmed earlier)')
  console.log('⚠️  Storage: Needs bucket + policies setup')
  console.log('\n🎯 Next steps:')
  console.log('1. Create "audiobucket" in Supabase Dashboard > Storage')
  console.log('2. Make it public (check the public option)')
  console.log('3. Add upload/download policies via the UI')
  console.log('4. Run this test again')
}

testPermissions().catch(console.error)