// Extract and display the formatted output
const response = {
  "rendered_md": "Here is the completed MRI Lumbosacral Spine Report based on your template and the provided information:\n\nClinical Information:\n48-year-old construction worker presents with 8 weeks of chronic lumbar back pain with bilateral sciatica extending to both feet. Pain is worse in the morning and with prolonged sitting. Previous conservative treatment including physiotherapy has not provided relief.\n\n## Technique:\nSagittal T1-weighted and T2-weighted STIR sequences of the lumbosacral spine were obtained.\n\n## Comparison:\nNo prior imaging is available for comparison.\n\nFindings:\nThe last fully formed and axially scanned disc is considered as L5-S1.\n\nLocalizer images:\nIncreased subcutaneous fat is noted, suggestive of excessive body fat/raised BMI.\n\nSpinal cord:\nThe spinal cord terminates normally at the L1 level. No abnormal signal or evidence of demyelination is observed. There is no cord expansion or lesions noted on sagittal and axial images. No intradural or extradural lesions are present.\n\nBones and joints:\nNormal lumbar curvature and alignment are maintained. No pars defects are noted. Mild osteophyte formation is present. No wedge compression fractures are identified. Endplates show mild degenerative changes. Bone marrow signal is within normal limits. No evidence of inflammatory spondyloarthropathy. Mild facet joint arthropathy is noted, with slight ligamentum flavum thickening.\n\nVisualized thoracic discs and disc levels:\nVisualized thoracic discs show mild degenerative changes. The thoracic spinal canal and exit foramina are patent.\n\nLumbar discs and disc levels:\nThere is evidence of degenerative disc disease with varying degrees of disc desiccation and height loss.\n\nVisualised sacrum and iliac bones:\nThe sacral spinal canal is patent. No Tarlov's cysts are identified. Sacral exit foramina are clear. Bone marrow signal is unremarkable. The sacrococcygeal junction and coccyx appear normal. Sacroiliac joints and iliac bones are intact.\n\nSoft tissues:\nSoft tissues appear normal with no significant abnormalities. Increased subcutaneous fat is noted, suggestive of excessive body fat/raised BMI.\n\nOther findings:\nThe kidneys and adrenal glands appear normal. The aorta is of normal caliber with no paraaortic lymphadenopathy. The rectosigmoid region is unremarkable. No free fluid is seen. The uterus and adnexa are not evaluated in this study.\n\nConclusion/Recommendations:\nFeatures are most likely to represent the following as described and discussed above:\n\n- :\n\n- Degenerative disc disease with mild disc desiccation and height loss.\n- - Mild facet joint arthropathy with slight ligamentum flavum thickening.\n- - No significant neural foraminal or spinal canal stenosis.\n- Let me know if you'd like to adjust or add anything.\n\nLet me know if you'd like to adjust or add anything."
};

console.log("📄 CURRENT FORMATTED OUTPUT:");
console.log("═══════════════════════════════════════════════════════════════════");
console.log(response.rendered_md);
console.log("═══════════════════════════════════════════════════════════════════");

console.log("\n🎯 COMPARISON WITH YOUR TEMPLATE:");
console.log("✅ Matches: Clean section headers");
console.log("✅ Matches: Professional opening statement");  
console.log("✅ Matches: BMI macro integration");
console.log("⚠️ Needs: More specific disc-level bullet points");
console.log("⚠️ Fix: Conclusion formatting issue");
console.log("⚠️ Enhancement: Detailed nerve impingement descriptions");

console.log("\n🔧 ADJUSTMENTS NEEDED:");
console.log("1. Add specific '- At L#-#' bullet points for disc levels");
console.log("2. Fix conclusion bullet point formatting");
console.log("3. Add nerve impingement details (traversing vs exiting)");
console.log("4. Include more clinical detail similar to your template");