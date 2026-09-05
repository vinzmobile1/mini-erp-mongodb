const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Fix 1: Add a global id counter for ID generation
if (!content.includes('let idCounter = 0;')) {
    content = content.replace('const app = express();', 'const app = express();\nlet idCounter = 0;\nconst generateId = () => Date.now() + (++idCounter) + Math.floor(Math.random()*10000);');
}

content = content.replace(/Date\.now\(\) \+ Math\.floor\(Math\.random\(\)\*1000\)/g, 'generateId()');

// Fix 2: Fix fetchFlatOrders to use unique ID
content = content.replace(
    'for (const item of doc.items) {',
    'for (let idx = 0; idx < doc.items.length; idx++) {\n      const item = doc.items[idx];'
);
content = content.replace(
    'id: doc._id.toString() + "-" + item.sku,',
    'id: doc._id.toString() + "-" + item.sku + "-" + idx,'
);

fs.writeFileSync('server.ts', content);
