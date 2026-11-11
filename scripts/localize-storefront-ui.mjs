/** Register and wrap literal storefront copy. Run after adding new JSX copy. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const dictionaryPath='src/lib/international/storefrontCopy.json';
const dictionary=fs.existsSync(dictionaryPath)?JSON.parse(fs.readFileSync(dictionaryPath,'utf8')):{};
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
let count=0;
for(const file of [...files('src/components'),...files('src/app')].filter(f=>f.endsWith('.tsx')&&!f.includes('/admin/')&&!f.includes('/international/')&&!f.includes('/api/')&&!f.includes('/purchase/'))){
 let source=fs.readFileSync(file,'utf8');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 function visit(node){
  if(ts.isJsxText(node)){
   const text=node.getText(tree).replace(/\s+/g,' ').trim();
   let parent=node.parent,skip=false;
   while(parent){if(ts.isJsxElement(parent)&&['script','style','svg','pre','code','textarea','option','title'].includes(parent.openingElement.tagName.getText(tree)))skip=true;parent=parent.parent;}
   if(!skip&&/[A-Za-z]/.test(text)&&text.length>2&&!/[{}<>&]/.test(text)){
    const key='copy_'+crypto.createHash('sha256').update(text).digest('hex').slice(0,16);
    dictionary[key]=text;
    edits.push({start:node.getFullStart(),end:node.end,text:`${node.getText(tree).match(/^\s*/)[0]}<StorefrontText id=${JSON.stringify(key)} fallback=${JSON.stringify(text)} />${node.getText(tree).match(/\s*$/)[0]}`});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
 if(!edits.length)continue;
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 if(!source.includes("StorefrontText")){
  const imp='import { Text as StorefrontText } from "@/components/international/InternationalProvider";\n';
  const directive=source.match(/^(?:"use client"|'use client');\s*/);
  source=directive?source.slice(0,directive[0].length)+imp+source.slice(directive[0].length):imp+source;
 }
 fs.writeFileSync(file,source);count+=edits.length;
}
for (const file of files('src/lib/international').filter(f=>f.endsWith('.ts'))) {
 const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 function visit(node){if(ts.isNewExpression(node)&&node.expression.getText(tree)==='CommerceError'&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0])){const text=node.arguments[0].text;dictionary['copy_'+crypto.createHash('sha256').update(text).digest('hex').slice(0,16)]=text;}ts.forEachChild(node,visit);}visit(tree);
}
fs.writeFileSync(dictionaryPath,JSON.stringify(dictionary,null,2)+'\n');console.log(`Registered ${Object.keys(dictionary).length} copy strings; wrapped ${count} JSX text nodes.`);
