import re

with open("src/components/InputOrderForm.tsx", "r") as f:
    content = f.read()

# 1. Fix "Nama Customer" col span
content = content.replace(
    '<div className="space-y-1.5 md:col-span-2">\n                  <label htmlFor="nama-customer-input"',
    '<div className="space-y-1.5">\n                  <label htmlFor="nama-customer-input"'
)

# 2. Add space-y-4 to form
content = content.replace(
    '<form onSubmit={handleSubmitOrder} id="order-entry-form">',
    '<form onSubmit={handleSubmitOrder} id="order-entry-form" className="space-y-4">'
)

# 3. Extract Section 2
sec2_start = content.find('            {/* Section 2: Items Table (Multi-item support) */}')
sec2_end = content.find('          </div>\n\n          {/* Right Column: Sticky Summary & Action Card */}')

if sec2_start != -1 and sec2_end != -1:
    section_2 = content[sec2_start:sec2_end]
    content = content[:sec2_start] + content[sec2_end:]
    
    # Extract Quick Tips
    tips_start = content.find('            {/* Quick Tips Card */}')
    tips_end = content.find('          </div>\n        </div>\n      </form>')
    
    if tips_start != -1 and tips_end != -1:
        tips = content[tips_start:tips_end]
        content = content[:tips_start] + content[tips_end:]
        
        # Insert Section 2 and Tips before </form>
        insert_pos = content.find('        </div>\n      </form>')
        
        # Clean up the indentation of Section 2 and Tips if desired, but they are already fine.
        
        # Format the insertion
        insertion = f"\n        </div>\n\n        {section_2.strip()}\n\n        {tips.strip()}\n      </form>"
        content = content[:insert_pos] + insertion + content[insert_pos + 23:]

with open("src/components/InputOrderForm.tsx", "w") as f:
    f.write(content)

