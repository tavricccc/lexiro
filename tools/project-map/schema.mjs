import { parse } from '@babel/parser';

function tree(text) { return parse(text,{sourceType:'module',plugins:['typescript','jsx']}); }
function literal(node,text) {
  if(node.type==='TSAsExpression'||node.type==='TSSatisfiesExpression')return literal(node.expression,text);
  if(['NumericLiteral','StringLiteral','BooleanLiteral'].includes(node.type))return node.value;
  if(node.type==='ArrayExpression')return node.elements.map(item=>literal(item,text));
  if(node.type==='ObjectExpression')return Object.fromEntries(node.properties.map(property=>[property.key.name||property.key.value,literal(property.value,text)]));
  return text.slice(node.start,node.end);
}
function visit(node,fn) {
  if(!node||typeof node!=='object')return;
  if(node.type)fn(node);
  for(const [key,value] of Object.entries(node)) {
    if(['loc','start','end','comments','tokens'].includes(key))continue;
    if(Array.isArray(value))value.forEach(child=>visit(child,fn));
    else if(value&&typeof value==='object')visit(value,fn);
  }
}
export function constant(text,path,name) {
  let found;
  visit(tree(text),node=>{if(node.type==='VariableDeclarator'&&node.id.name===name&&node.init)found=literal(node.init,text);});
  if(found===undefined)throw new Error('設定常數不存在：'+path+' / '+name);
  return found;
}
export function interfaceFields(text,path,name) {
  const interfaces=new Map();
  visit(tree(text),node=>{if(node.type==='TSInterfaceDeclaration')interfaces.set(node.id.name,node);});
  const fields=target=>{
    const declaration=interfaces.get(target);
    if(!declaration)throw new Error('模型介面不存在：'+path+' / '+target);
    const inherited=(declaration.extends||[]).flatMap(parent=>fields(parent.expression.name));
    return [...inherited,...declaration.body.body.map(member=>({name:(member.key.name||member.key.value)+(member.optional?'?':''),type:text.slice(member.typeAnnotation.typeAnnotation.start,member.typeAnnotation.typeAnnotation.end)}))];
  };
  return fields(name);
}
