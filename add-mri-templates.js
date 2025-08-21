import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addMRITemplates() {
  try {
    console.log('Adding MRI Lumbar Spine template...');

    // First update the existing template with comprehensive MRI LS data
    const { data: updateData, error: updateError } = await supabase
      .from('templates')
      .update({
        name: 'MRI Lumbar Spine',
        description: 'MRI Lumbosacral Spine reporting template with comprehensive checklists',
        system_prompt: 'You are an expert radiologist creating structured MRI lumbar spine reports. Follow the specific template format exactly as provided, including all headings and checklist items. Apply the general rules and macro replacements as specified.',
        output_schema: {
          "clinical_information": "string",
          "technique": "string", 
          "comparison": "string",
          "findings": {
            "last_formed_disc": "The last fully formed and axially scanned disc is considered as L5-S1.",
            "localizer_images": "string",
            "spinal_cord": {
              "description": "string",
              "checklist_items": ["TERMINATION", "SIGNAL", "DEMYELINATION", "CORD EXPANSION", "CORD LESION ON SAG AND AXIAL", "INTRADURAL", "EXTRADURAL"]
            },
            "bones_and_joints": {
              "description": "string", 
              "checklist_items": ["CURVATURE AND ALIGNMENT", "PARS DEFECT", "OSTEOPHYTES", "WEDGE COMPRESSION", "ENDPLATES", "BONE MARROW", "INFLAMMATORY SPONDYLOARTHROPATHY", "FACET JOINT", "LIGAMENTUM FLAVUM"]
            },
            "thoracic_discs": {
              "description": "string",
              "checklist_items": ["DISCS", "CANAL", "EXIT FORAMINA"]
            },
            "lumbar_discs": {
              "description": "string",
              "checklist_items": ["L1-2", "L2-3", "L3-4", "L4-5", "L5-S1"]
            },
            "sacrum_iliac": {
              "description": "string",
              "checklist_items": ["SACRAL SPINAL CANAL", "TARLOV'S CYST", "SACRAL EXIT FORAMINA", "SACRAL BONE MARROW", "SACROCOCCYGEAL JUNCTION", "COCCYX", "SIJS", "ILIAC BONES"]
            },
            "soft_tissues": {
              "description": "string",
              "checklist_items": ["RETROPERITONEUM", "PRESACRAL", "INTERSPINOUS", "ANTERIOR PARAVERTEBRAL", "POSTERIOR PARAVERTEBRAL", "SUBCUTANEOUS"]
            },
            "other_findings": {
              "description": "string",
              "checklist_items": ["KIDNEYS", "ADRENAL", "AORTA", "PARAAORTIC NODES", "RECTOSIGMOID", "FREE FLUID", "UTERUS", "ADNEXA"]
            }
          },
          "conclusion_recommendations": "string"
        },
        // Note: template_instructions will be added later when schema is updated
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (updateError) {
      console.error('Error updating MRI template:', updateError);
      return;
    }

    console.log('✅ Updated MRI Lumbar Spine template successfully');

    // Add Chest X-ray template
    const { data: chestData, error: chestError } = await supabase
      .from('templates')
      .upsert({
        id: 2,
        org_id: 1,
        name: 'Chest X-Ray',
        description: 'Standard chest radiograph reporting template with systematic approach',
        system_prompt: 'You are an expert radiologist creating structured chest X-ray reports. Follow systematic evaluation approach covering all anatomical structures.',
        output_schema: {
          "clinical_information": "string",
          "technique": "string",
          "comparison": "string", 
          "findings": {
            "heart": "string",
            "lungs": {
              "right_lung": "string",
              "left_lung": "string"
            },
            "pleura": "string",
            "bones": "string",
            "soft_tissues": "string",
            "lines_tubes": "string"
          },
          "impression": "string",
          "recommendations": "string"
        },
        // template_instructions will be added with schema update
        created_by: 1,
        is_active: true
      });

    if (chestError) {
      console.error('Error adding Chest X-ray template:', chestError);
      return;
    }

    console.log('✅ Added Chest X-Ray template successfully');

    // Add CT Head template
    const { data: ctData, error: ctError } = await supabase
      .from('templates')
      .upsert({
        id: 3,
        org_id: 1,
        name: 'CT Head',
        description: 'CT Head scan reporting template with systematic brain evaluation',
        system_prompt: 'You are an expert radiologist creating structured CT head reports. Follow systematic evaluation of brain structures.',
        output_schema: {
          "clinical_information": "string",
          "technique": "string",
          "comparison": "string",
          "findings": {
            "brain_parenchyma": "string", 
            "ventricles": "string",
            "cisterns": "string",
            "skull_bones": "string",
            "soft_tissues": "string"
          },
          "impression": "string",
          "recommendations": "string"
        },
        // template_instructions will be added with schema update
        created_by: 1,
        is_active: true
      });

    if (ctError) {
      console.error('Error adding CT Head template:', ctError);
      return;
    }

    console.log('✅ Added CT Head template successfully');

    // Verify the templates were added
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      return;
    }

    console.log('\n📋 Current templates in database:');
    templates.forEach(template => {
      console.log(`  ${template.id}. ${template.name} - ${template.description}`);
    });

    console.log('\n✨ All templates added successfully! Ready for LLM integration.');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addMRITemplates();