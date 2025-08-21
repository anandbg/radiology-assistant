import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateSchema() {
  try {
    console.log('Adding template_instructions column to templates table...');
    
    // Execute the schema update using RPC call with SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE templates 
        ADD COLUMN IF NOT EXISTS template_instructions JSONB DEFAULT '{}';
        
        UPDATE templates 
        SET template_instructions = '{"general_rules": ["Follow template format exactly", "Convert phrases to sentences"], "template_format": "Standard report format"}'::jsonb
        WHERE template_instructions IS NULL OR template_instructions = '{}'::jsonb;
      `
    });

    if (error) {
      console.error('Error updating schema:', error);
      console.log('Trying alternative approach...');
      
      // Alternative approach - check if column exists first
      const { data: columns, error: columnError } = await supabase
        .from('templates')
        .select('*')
        .limit(1);
        
      if (columnError && columnError.message.includes('template_instructions')) {
        console.log('Column template_instructions does not exist. Schema update needed.');
      } else {
        console.log('Column might already exist. Proceeding with data insertion...');
      }
      return;
    }

    console.log('✅ Schema updated successfully');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateSchema();