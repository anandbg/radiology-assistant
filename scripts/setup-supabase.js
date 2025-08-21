import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('🔗 Testing Supabase connection...')
  console.log('URL:', supabaseUrl)
  console.log('Key:', supabaseKey.substring(0, 20) + '...')
  
  try {
    // Try to get service status
    const { data, error } = await supabase.from('organizations').select('id').limit(1)
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️  Tables not created yet - connection OK but schema needed')
        return 'schema_needed'
      } else {
        console.error('❌ Connection failed:', error.message)
        return false
      }
    }
    
    console.log('✅ Supabase connection and schema ready!')
    return true
  } catch (err) {
    console.error('❌ Connection error:', err.message)
    return false
  }
}

async function verifySchema() {
  console.log('\n🔍 Verifying database schema...')
  
  const tables = [
    'organizations', 'users', 'templates', 'chats', 'messages', 'usage_tracking', 'documents', 'document_chunks'
  ]
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1)
      if (error && error.code === 'PGRST116') {
        console.log(`❌ Table '${table}' missing`)
        return false
      } else {
        console.log(`✅ Table '${table}' exists`)
      }
    } catch (err) {
      console.log(`❌ Error checking table '${table}':`, err.message)
      return false
    }
  }
  
  console.log('\n✅ All required tables exist!')
  return true
}

async function setupDatabase() {
  console.log('\n📋 Database setup instructions:')
  console.log('\n1. Go to your Supabase project dashboard:')
  console.log('   https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].replace('https://', ''))
  console.log('\n2. Click on "SQL Editor" in the left sidebar')
  console.log('\n3. Click "New Query" and paste the contents of supabase-schema.sql')
  console.log('\n4. Run the query to create all tables and structures')
  console.log('\n5. Run this script again to verify setup')
  
  console.log('\n📄 Schema file: supabase-schema.sql')
  console.log('\nTo view the schema:')
  console.log('cat supabase-schema.sql')
}

async function insertSampleData() {
  console.log('\n🌱 Inserting sample data...')
  
  try {
    // Insert organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert([{ id: 1, name: 'Demo Hospital', domain: 'demo.radiologyassistant.com' }], { onConflict: 'id' })
      .select()
    
    if (orgError && !orgError.message.includes('duplicate key')) {
      console.error('❌ Error creating organization:', orgError.message)
      return false
    }
    console.log('✅ Demo organization ready')
    
    // Insert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert([{ 
        id: 1, 
        org_id: 1, 
        email: 'demo@example.com', 
        full_name: 'Demo User', 
        role: 'admin' 
      }], { onConflict: 'id' })
      .select()
    
    if (userError && !userError.message.includes('duplicate key')) {
      console.error('❌ Error creating user:', userError.message)
      return false
    }
    console.log('✅ Demo user ready')
    
    // Insert template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .upsert([{
        id: 1,
        org_id: 1,
        name: 'Chest X-Ray Report',
        description: 'Standard chest radiograph reporting template',
        system_prompt: 'You are a radiologist creating structured reports.',
        output_schema: JSON.stringify({
          patient_info: { age: 'string', sex: 'string' },
          clinical_history: 'string',
          technique: 'string',
          findings: {
            heart: 'string',
            lungs: 'string',
            pleura: 'string',
            bones: 'string'
          },
          impression: 'string',
          recommendations: 'string'
        }),
        created_by: 1,
        is_active: true
      }], { onConflict: 'id' })
      .select()
    
    if (templateError && !templateError.message.includes('duplicate key')) {
      console.error('❌ Error creating template:', templateError.message)
      return false
    }
    console.log('✅ Demo template ready')
    
    console.log('\n🎉 Sample data ready!')
    return true
  } catch (err) {
    console.error('❌ Error inserting sample data:', err.message)
    return false
  }
}

async function main() {
  console.log('🚀 Supabase Setup Script\n')
  
  const connectionResult = await testConnection()
  
  if (connectionResult === true) {
    console.log('\n🔍 Connection successful, verifying schema...')
    const schemaOk = await verifySchema()
    
    if (schemaOk) {
      console.log('\n🌱 Schema verified, setting up sample data...')
      const dataOk = await insertSampleData()
      if (dataOk) {
        console.log('\n✅ Supabase setup complete! Ready to use.')
        console.log('\n🎯 Next steps:')
        console.log('1. Build the application: npm run build')
        console.log('2. Start development server: pm2 start ecosystem.config.cjs')
        console.log('3. Test the connection at http://localhost:3000')
      }
    } else {
      console.log('\n❌ Schema incomplete. Please run the SQL script first.')
      await setupDatabase()
    }
  } else if (connectionResult === 'schema_needed') {
    console.log('\n📋 Connection OK, but schema setup needed:')
    await setupDatabase()
  } else {
    console.log('\n❌ Please fix connection issues first')
    process.exit(1)
  }
}

main().catch(console.error)