const fs = require("fs");
const path = require("path");

const filesToPatch = [
  path.join(__dirname, "../node_modules/simple-table-core/dist/index.es.js"),
  path.join(__dirname, "../node_modules/simple-table-core/dist/cjs/index.js")
];

const target = `x=t=>{const e=t.target;if(!m.contains(e)&&!(null==g?void 0:g.contains(e))){if("absolute"===c){const t=m.parentElement;if(null==t?void 0:t.contains(e))return}S(!1),null==s||s()}}`;
const replacement = `x=t=>{const e=t.target;if(!m.contains(e)&&!(null==g?void 0:g.contains(e))){if(e&&typeof e.closest==="function"&&e.closest(".st-dropdown-content, .st-custom-select-dropdown, .st-datepicker, .st-custom-select-options, .st-custom-select, .st-filter-container, .st-filter-dropdown"))return;if("absolute"===c){const t=m.parentElement;if(null==t?void 0:t.contains(e))return}S(!1),null==s||s()}}`;

for (const file of filesToPatch) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(file, content, "utf8");
      console.log(`[Patch] Successfully patched ${path.basename(file)}`);
    } else {
      console.log(`[Patch] Target already patched or not found in ${path.basename(file)}`);
    }
  }
}
