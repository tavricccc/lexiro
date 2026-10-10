export interface FirestoreValue { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; timestampValue?: string; arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> } }
export interface FirestoreDocument { name: string; fields: Record<string, FirestoreValue>; updateTime?: string }
export function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,decode(value)]));
}
function decode(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  throw new Error('Firestore 欄位格式不受支援');
}
export function encodeFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
}
function encode(value: unknown): FirestoreValue {
  if (value===null) return {nullValue:null};
  if (typeof value==='string') return {stringValue:value};
  if (typeof value==='boolean') return {booleanValue:value};
  if (typeof value==='number' && Number.isFinite(value)) return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  if (typeof value==='object') return {mapValue:{fields:encodeFields(value as Record<string,unknown>)}};
  throw new Error('無法儲存這個 Firestore 欄位');
}
