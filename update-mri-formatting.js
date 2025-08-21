import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateMRITemplateFormatting() {
  try {
    console.log('🔄 Updating MRI template to match your uploaded format...');

    // Enhanced system prompt that matches your formatting style
    const enhancedSystemPrompt = `You are an expert radiologist creating structured MRI lumbar spine reports. 

CRITICAL FORMATTING REQUIREMENTS based on the provided template example:
1. Use clean, professional section headers without bold markdown
2. For lumbar disc findings, use detailed bullet points with "- At L#-#" format
3. Include specific nerve impingement details (traversing vs exiting nerves)
4. Use medical terminology precisely (thecal sac, ligamentum flavum, etc.)
5. Apply macro replacements naturally in context
6. Format conclusions with bullet-pointed key findings
7. Include professional closing statement

EXAMPLE OUTPUT STYLE:
"Clinical Information:
[Clinical details]

## Technique:
[Technical details]

Lumbar discs and disc levels:
[General description if applicable]

- At L3-4, there is [specific finding with anatomical detail]
- At L4-5, there is [specific finding with nerve impact]
- At L5-S1, there is [specific finding]"

Generate comprehensive, professional reports following this exact formatting style.`;

    // Enhanced template instructions matching the uploaded format
    const enhancedInstructions = {
      "general_rules": [
        "Match the exact formatting style of the provided template",
        "Use clean section headers without bold markdown for main sections", 
        "Format disc findings with detailed bullet points using '- At L#-#' structure",
        "Include specific nerve impingement details (traversing vs exiting nerves)",
        "Use professional medical terminology (thecal sac, ligamentum flavum, facet joints)",
        "Apply macro replacements naturally within appropriate sections",
        "Format conclusion with bullet-pointed key findings starting with 'Features are most likely to represent the following as described and discussed above:'",
        "End with professional closing: 'Let me know if you'd like to adjust or add anything.'"
      ],
      "macros": {
        "BMI": "Increased subcutaneous fat is noted, suggestive of excessive body fat/raised BMI",
        "LABRUM": "Within the limitations of non-arthrographic examination, the labrum appears intact and unremarkable with no evidence of labral tear or SLAP lesion"
      },
      "formatting_examples": {
        "disc_findings": "- At L4-5, there is mild impingement on the exiting left L5 nerve.",
        "nerve_detail": "there is flattening of the anterior margin of the thecal sac with mild impingement on the traversing L4 nerves bilaterally",
        "conclusion_format": "Features are most likely to represent the following as described and discussed above:\n\n- Degenerative disc disease with mild bulges at L3-4 and L5-S1.\n- Nerve impingement at multiple levels with specific anatomical detail."
      },
      "template_format": "Here is the completed MRI Lumbosacral Spine Report based on your template and the provided information:\n\nClinical Information:\n[Details]\n\n## Technique:\n[Technical details]\n\n## Comparison:\n[Comparison details]\n\nFindings:\nThe last fully formed and axially scanned disc is considered as L5-S1.\n\nLocalizer images:\n[Include BMI macro if appropriate]\n\nSpinal cord:\n[Detailed cord assessment]\n\nBones and joints:\n[Detailed bone and joint findings]\n\nVisualized thoracic discs and disc levels:\n[Thoracic assessment]\n\nLumbar discs and disc levels:\n[General description]\n\n- At L1-2, [specific finding]\n- At L2-3, [specific finding]\n- At L3-4, [specific finding with nerve details]\n- At L4-5, [specific finding with nerve details]\n- At L5-S1, [specific finding with nerve details]\n\nVisualised sacrum and iliac bones:\n[Sacrum and iliac assessment]\n\nSoft tissues:\n[Detailed soft tissue findings including muscle assessment]\n\nOther findings:\n[Incidental findings]\n\nConclusion/Recommendations:\nFeatures are most likely to represent the following as described and discussed above:\n\n- [Key finding 1]\n- [Key finding 2]\n- [Key finding 3]\n\nLet me know if you'd like to adjust or add anything."
    };

    // Update the MRI template with enhanced formatting
    const { data, error } = await supabase
      .from('templates')
      .update({
        system_prompt: enhancedSystemPrompt,
        retrieval_config: enhancedInstructions,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) {
      console.error('❌ Error updating MRI template:', error);
      return;
    }

    console.log('✅ MRI template updated to match your formatting style!');
    console.log('📋 Enhancements applied:');
    console.log('   • Clean section headers without bold markdown');
    console.log('   • Detailed bullet points for disc findings');
    console.log('   • Specific nerve impingement descriptions');
    console.log('   • Professional medical terminology');
    console.log('   • Bullet-pointed conclusion format');
    console.log('   • Professional closing statement');
    console.log('');
    console.log('🎯 Your radiology assistant will now generate reports in the exact style of your uploaded template!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateMRITemplateFormatting();