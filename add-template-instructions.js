import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addTemplateInstructions() {
  try {
    console.log('Updating templates with comprehensive instructions...');

    // Update MRI Lumbar Spine template with complete configuration
    const mriInstructions = {
      "general_rules": [
        "Keep all headings exactly as provided",
        "Convert phrases to full sentences", 
        "All checklists in CAPITALS are for internal use - do not include CAPITAL words in final report",
        "Display all checklist items when template is requested",
        "Do not modify template structure",
        "If no Clinical Information dictated, delete the heading",
        "Start Conclusion with: 'Features are most likely to represent the following as described and discussed above.'"
      ],
      "macros": {
        "BMI": "Increased subcutaneous fat is noted, suggestive of excessive body fat/raised BMI.",
        "LABRUM": "Within the limitations of non-arthrographic examination, the labrum appears intact and unremarkable with no evidence of labral tear or SLAP lesion."
      },
      "template_format": "Clinical Information:\n\nTechnique:\n\nComparison:\n\nFindings:\n\nThe last fully formed and axially scanned disc is considered as L5-S1.\n\nLocalizer images:\n\nSpinal cord:\n(CHECKLIST: TERMINATION, SIGNAL, DEMYELINATION, CORD EXPANSION, CORD LESION ON SAG AND AXIAL, INTRADURAL, EXTRADURAL)\n\nBones and joints:\n(CHECKLIST: CURVATURE AND ALIGNMENT, PARS DEFECT, OSTEOPHYTES, WEDGE COMPRESSION, ENDPLATES, BONE MARROW, INFLAMMATORY SPONDYLOARTHROPATHY, FACET JOINT, LIGAMENTUM FLAVUM)\n\nVisualized thoracic discs and disc levels:\n(CHECKLIST: DISCS, CANAL, EXIT FORAMINA)\n\nLumbar discs and disc levels:\n(CHECKLIST: L1-2, L2-3, L3-4, L4-5, L5-S1)\n\nVisualised sacrum and iliac bones:\n(CHECKLIST: SACRAL SPINAL CANAL, TARLOV'S CYST, SACRAL EXIT FORAMINA, SACRAL BONE MARROW, SACROCOCCYGEAL JUNCTION, COCCYX, SIJS, ILIAC BONES)\n\nSoft tissues:\n(CHECKLIST: RETROPERITONEUM, PRESACRAL, INTERSPINOUS, ANTERIOR PARAVERTEBRAL, POSTERIOR PARAVERTEBRAL, SUBCUTANEOUS)\n\nOther findings:\n(CHECKLIST: KIDNEYS, ADRENAL, AORTA, PARAAORTIC NODES, RECTOSIGMOID, FREE FLUID, UTERUS, ADNEXA)\n\nConclusion/Recommendations:"
    };

    // Try updating with retrieval_config (this column should exist)
    const { data: mriData, error: mriError } = await supabase
      .from('templates')
      .update({
        retrieval_config: mriInstructions
      })
      .eq('id', 1);

    if (mriError) {
      console.error('Error updating MRI template instructions:', mriError);
    } else {
      console.log('✅ Updated MRI Lumbar Spine template with comprehensive instructions');
    }

    // Update Chest X-ray template
    const chestInstructions = {
      "general_rules": [
        "Keep all headings exactly as provided",
        "Convert phrases to full sentences",
        "Apply macro replacements as specified",
        "Start Conclusion with: 'Features are most likely to represent the following as described and discussed above.'"
      ],
      "template_format": "Clinical Information:\n\nTechnique:\n\nComparison:\n\nFindings:\n\nHeart:\n\nLungs:\nRight lung:\nLeft lung:\n\nPleura:\n\nBones:\n\nSoft tissues:\n\nLines and tubes:\n\nImpression:\n\nRecommendations:"
    };

    const { data: chestData, error: chestError } = await supabase
      .from('templates')
      .update({
        retrieval_config: chestInstructions
      })
      .eq('id', 2);

    if (chestError) {
      console.error('Error updating Chest X-ray template:', chestError);
    } else {
      console.log('✅ Updated Chest X-Ray template with instructions');
    }

    // Update CT Head template
    const ctInstructions = {
      "general_rules": [
        "Keep all headings exactly as provided", 
        "Convert phrases to full sentences",
        "Apply macro replacements as specified",
        "Start Conclusion with: 'Features are most likely to represent the following as described and discussed above.'"
      ],
      "template_format": "Clinical Information:\n\nTechnique:\n\nComparison:\n\nFindings:\n\nBrain parenchyma:\n\nVentricles:\n\nCisterns:\n\nSkull and bones:\n\nSoft tissues:\n\nImpression:\n\nRecommendations:"
    };

    const { data: ctData, error: ctError } = await supabase
      .from('templates')
      .update({
        retrieval_config: ctInstructions
      })
      .eq('id', 3);

    if (ctError) {
      console.error('Error updating CT Head template:', ctError);
    } else {
      console.log('✅ Updated CT Head template with instructions');
    }

    // Verify the templates now have instructions
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('id, name, retrieval_config')
      .order('id');

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      return;
    }

    console.log('\n📋 Templates with instructions:');
    templates.forEach(template => {
      const hasInstructions = template.retrieval_config && Object.keys(template.retrieval_config).length > 0;
      console.log(`  ${template.id}. ${template.name} - ${hasInstructions ? '✅ Has instructions' : '❌ No instructions'}`);
    });

    console.log('\n✨ All template instructions updated successfully!');
    console.log('\nNext steps:');
    console.log('1. Add OpenAI API key configuration');
    console.log('2. Update LLM service to use template instructions');
    console.log('3. Test end-to-end workflow');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addTemplateInstructions();