const fs = require('fs');
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const s = fs.readFileSync('F:/Cartier/original/app.js','utf8');
const ast = acorn.parse(s,{ecmaVersion:'latest',sourceType:'module'});
const declarations = new Map();
for (const statement of ast.body) if(statement.type==='VariableDeclaration') for(const d of statement.declarations) if(d.id.type==='Identifier') declarations.set(d.id.name,d.init);
const evaluating = new Set();
function val(n){
 if(!n) return null;
 if(n.type==='Literal') return n.value;
 if(n.type==='TemplateLiteral'&&!n.expressions.length) return n.quasis[0].value.cooked;
 if(n.type==='ArrayExpression') return n.elements.map(val);
 if(n.type==='ObjectExpression') return Object.fromEntries(n.properties.map(p=>[p.key.name??p.key.value,val(p.value)]));
 if(n.type==='UnaryExpression'&&n.operator==='-')return -val(n.argument);
 if(n.type==='UnaryExpression'&&n.operator==='!')return !val(n.argument);
 if(n.type==='ArrowFunctionExpression'&&n.body.type!=='BlockStatement')return val(n.body);
 if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='Object'&&['freeze','defineProperty'].includes(n.callee.property.name))return val(n.arguments[0]);
 if(n.type==='Identifier'&&declarations.has(n.name)&&!evaluating.has(n.name)){evaluating.add(n.name);const r=val(declarations.get(n.name));evaluating.delete(n.name);return r;}
 return {unsupported:n.type,code:s.slice(n.start,n.end).slice(0,100)};
}
const data=val(declarations.get('Snt'));
const tables=Object.fromEntries(['IG','pO','RG','NG','DG','OG','zG'].map(k=>[k,val(declarations.get(k))]));
const enfr={global:{...tables.IG.en_fr,podcasts:tables.pO.en_fr.pages.filter(p=>p.type==='podcast')},pages:['RG','NG','DG','OG','zG'].map(k=>tables[k].en_fr)};
fs.writeFileSync('F:/Cartier/audit/en_fr-data.json',JSON.stringify(enfr,null,2));
const literals=[],templates=[],imports=[];
function walk(n,parent){if(!n||typeof n!=='object')return;if(n.type==='Literal'&&typeof n.value==='string')literals.push({v:n.value,start:n.start});if(n.type==='TemplateLiteral')templates.push({code:s.slice(n.start,n.end),start:n.start});if(n.type==='ImportDeclaration'||n.type==='ImportExpression')imports.push(s.slice(n.start,n.end));for(const [key,v]of Object.entries(n)){if(key==='start'||key==='end')continue;if(Array.isArray(v))v.forEach(x=>walk(x,n));else if(v&&typeof v==='object')walk(v,n)}}
walk(ast);
const all=Array.from(new Set(literals.filter(x=>x.v.length<500&&/\.(png|jpe?g|webp|svg|mp[34]|webm|ogg|glb|gltf|exr|3dl|ktx2?|wasm|woff2?|json|js|css)$/i.test(x.v)).map(x=>x.v))).sort();
fs.writeFileSync('F:/Cartier/audit/parsed-assets.json',JSON.stringify(all,null,2));
fs.writeFileSync('F:/Cartier/audit/templates.json',JSON.stringify(templates.filter(x=>/images|audio|video|webgl|assets|\.webp|\.png|\.json|\.glb/.test(x.code)),null,2));
console.log(JSON.stringify({localeCount:Object.keys(data).length,enFrPages:enfr.pages.map(p=>({uri:p.uri,title:p.title})),assetCount:all.length,imports,templates:templates.filter(x=>/images|audio|video|webgl|assets|\.webp|\.png|\.json|\.glb/.test(x.code))},null,2));
