-- Insert the MRI Lumbar Spine template with full instructions
-- This should be run in the Supabase SQL Editor

-- First, let's update the existing template with the complete MRI LS template
UPDATE templates 
SET 
  name = 'MRI Lumbar Spine',
  description = 'MRI Lumbosacral Spine reporting template with comprehensive checklists',
  system_prompt = 'You are an expert radiologist creating structured MRI lumbar spine reports. Follow the specific template format exactly as provided, including all headings and checklist items. Apply the general rules and macro replacements as specified.',
  output_schema = '{
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
        "checklist_items": ["SACRAL SPINAL CANAL", "TARLOV\\'S CYST", "SACRAL EXIT FORAMINA", "SACRAL BONE MARROW", "SACROCOCCYGEAL JUNCTION", "COCCYX", "SIJS", "ILIAC BONES"]
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
  }',
  template_instructions = '{
    "general_rules": [
      "Keep all headings exactly as provided",
      "Convert phrases to full sentences", 
      "All checklists in CAPITALS are for internal use - do not include CAPITAL words in final report",
      "Display all checklist items when template is requested",
      "Do not modify template structure",
      "If no Clinical Information dictated, delete the heading",
      "Start Conclusion with: ''Features are most likely to represent the following as described and discussed above.''"
    ],
    "macros": {
      "BMI": "Increased subcutaneous fat is noted, suggestive of excessive body fat/raised BMI.",
      "LABRUM": "Within the limitations of non-arthrographic examination, the labrum appears intact and unremarkable with no evidence of labral tear or SLAP lesion."
    },
    "template_format": "Clinical Information:\\n\\nTechnique:\\n\\nComparison:\\n\\nFindings:\\n\\nThe last fully formed and axially scanned disc is considered as L5-S1.\\n\\nLocalizer images:\\n\\nSpinal cord:\\n(CHECKLIST: TERMINATION, SIGNAL, DEMYELINATION, CORD EXPANSION, CORD LESION ON SAG AND AXIAL, INTRADURAL, EXTRADURAL)\\n\\nBones and joints:\\n(CHECKLIST: CURVATURE AND ALIGNMENT, PARS DEFECT, OSTEOPHYTES, WEDGE COMPRESSION, ENDPLATES, BONE MARROW, INFLAMMATORY SPONDYLOARTHROPATHY, FACET JOINT, LIGAMENTUM FLAVUM)\\n\\nVisualized thoracic discs and disc levels:\\n(CHECKLIST: DISCS, CANAL, EXIT FORAMINA)\\n\\nLumbar discs and disc levels:\\n(CHECKLIST: L1-2, L2-3, L3-4, L4-5, L5-S1)\\n\\nVisualised sacrum and iliac bones:\\n(CHECKLIST: SACRAL SPINAL CANAL, TARLOV\\'S CYST, SACRAL EXIT FORAMINA, SACRAL BONE MARROW, SACROCOCCYGEAL JUNCTION, COCCYX, SIJS, ILIAC BONES)\\n\\nSoft tissues:\\n(CHECKLIST: RETROPERITONEUM, PRESACRAL, INTERSPINOUS, ANTERIOR PARAVERTEBRAL, POSTERIOR PARAVERTEBRAL, SUBCUTANEOUS)\\n\\nOther findings:\\n(CHECKLIST: KIDNEYS, ADRENAL, AORTA, PARAAORTIC NODES, RECTOSIGMOID, FREE FLUID, UTERUS, ADNEXA)\\n\\nConclusion/Recommendations:"
  }'
WHERE id = 1;

-- Insert additional template examples
INSERT INTO templates (id, org_id, name, description, system_prompt, output_schema, template_instructions, created_by, is_active) VALUES

-- General Chest X-ray template
(2, 1, 'Chest X-Ray', 'Standard chest radiograph reporting template with systematic approach', 
'You are an expert radiologist creating structured chest X-ray reports. Follow systematic evaluation approach covering all anatomical structures.',
'{
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
}',
'{
  "general_rules": [
    "Keep all headings exactly as provided",
    "Convert phrases to full sentences",
    "Apply macro replacements as specified",
    "Start Conclusion with: ''Features are most likely to represent the following as described and discussed above.''"
  ],
  "template_format": "Clinical Information:\n\nTechnique:\n\nComparison:\n\nFindings:\n\nHeart:\n\nLungs:\nRight lung:\nLeft lung:\n\nPleura:\n\nBones:\n\nSoft tissues:\n\nLines and tubes:\n\nImpression:\n\nRecommendations:"
}', 1, true),

-- CT Head template  
(3, 1, 'CT Head', 'CT Head scan reporting template with systematic brain evaluation',
'You are an expert radiologist creating structured CT head reports. Follow systematic evaluation of brain structures.',
'{
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
}',
'{
  "general_rules": [
    "Keep all headings exactly as provided", 
    "Convert phrases to full sentences",
    "Apply macro replacements as specified",
    "Start Conclusion with: ''Features are most likely to represent the following as described and discussed above.''"
  ],
  "template_format": "Clinical Information:\n\nTechnique:\n\nComparison:\n\nFindings:\n\nBrain parenchyma:\n\nVentricles:\n\nCisterns:\n\nSkull and bones:\n\nSoft tissues:\n\nImpression:\n\nRecommendations:"
}', 1, true)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  output_schema = EXCLUDED.output_schema,
  template_instructions = EXCLUDED.template_instructions,
  updated_at = NOW();