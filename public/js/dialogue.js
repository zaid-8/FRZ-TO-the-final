
export const DIALOGUE_FIELDS=Object.freeze(['days','people','budget','originId','interests','pace','nationality','transport','mustVisit','roundTrip','startDate']);
export const REQUIRED_DIALOGUE_FIELDS=Object.freeze(['days','people','originId','interests','budget','transport','nationality']);

export function normalizeKnownFields(input){return [...new Set((Array.isArray(input)?input:[]).filter(field=>DIALOGUE_FIELDS.includes(field)))];}
export function changeKnownField(input,field,confirmed=true){const fields=normalizeKnownFields(input).filter(item=>item!==field);if(confirmed&&DIALOGUE_FIELDS.includes(field))fields.push(field);return fields;}
export function confirmProfileFields(profile){return DIALOGUE_FIELDS.filter(field=>Object.hasOwn(profile||{},field)&&(field!=='interests'||Array.isArray(profile.interests)&&profile.interests.length>0));}
export function dialogueDecision(action,knownFields,needs=[],requiredFields=REQUIRED_DIALOGUE_FIELDS){
 if(!['clarify','discuss','plan'].includes(action))throw new Error('وصل رد غير مكتمل من نشمي. جرّب إعادة الإرسال.');
 const known=normalizeKnownFields(knownFields),required=normalizeKnownFields(requiredFields),missing=required.filter(field=>!known.includes(field));
 const outstanding=[...new Set([...missing,...normalizeKnownFields(needs).filter(field=>required.includes(field))])];
 return {action,knownFields:known,missing:outstanding,provisional:action==='plan'&&missing.length>0,canPlan:action==='plan'&&(!Array.isArray(needs)||needs.length===0)};
}
