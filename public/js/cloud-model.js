import {CATALOG} from './catalog.js';

export const CLOUD_PROFILE_KEYS = Object.freeze(['days', 'people', 'budget', 'originId', 'interests', 'pace', 'nationality', 'transport', 'mustVisit', 'roundTrip', 'startDate', 'rates']);
export const CLOUD_RATE_KEYS = Object.freeze(['foodPerPersonDay', 'roomPerNight', 'ownCarPerKm', 'driverPerDay', 'publicPerPersonDay']);
const INTERESTS = ['nature', 'history', 'culture', 'adventure', 'relax', 'sea'];
const PAYLOAD_KEYS = ['savedIds', 'tripProfile', 'tripStopIds', 'title'];
const STORED_KEYS = ['version', ...PAYLOAD_KEYS, 'updatedAt'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export class CloudDataError extends Error {
  constructor(message = 'بيانات الرحلة المحفوظة غير صالحة. راجع خياراتها قبل المحاولة.') {
    super(message);
    this.name = 'CloudDataError';
    this.code = 'CLOUD_INVALID_DATA';
  }
}

function exactFields(value, allowed, required = allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !own(value, key))) throw new CloudDataError();
}

function destinationIds(value, catalog) {
  const allowed = new Set(catalog.map(place => place.id));
  if (!Array.isArray(value) || value.length > allowed.size || value.some(id => typeof id !== 'string' || !allowed.has(id)) || new Set(value).size !== value.length) throw new CloudDataError();
  return [...value];
}

export function validateCloudProfile(input, catalog = CATALOG) {
  exactFields(input, CLOUD_PROFILE_KEYS);
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 7 || !Number.isInteger(input.people) || input.people < 1 || input.people > 12) throw new CloudDataError();
  if (input.budget !== null && (!finite(input.budget) || input.budget < 0 || input.budget > 1000000)) throw new CloudDataError();
  if (!catalog.some(place => place.id === input.originId)) throw new CloudDataError();
  if (!Array.isArray(input.interests) || input.interests.length < 1 || input.interests.length > 6 || input.interests.some(value => !INTERESTS.includes(value)) || new Set(input.interests).size !== input.interests.length) throw new CloudDataError();
  if (!['relaxed', 'balanced', 'active'].includes(input.pace) || !['jordanian', 'foreign'].includes(input.nationality) || !['car', 'driver', 'public'].includes(input.transport)) throw new CloudDataError();
  if (typeof input.roundTrip !== 'boolean' || (input.startDate !== null && !validDate(input.startDate))) throw new CloudDataError();
  exactFields(input.rates, CLOUD_RATE_KEYS);
  const rates = {};
  for (const key of CLOUD_RATE_KEYS) {
    const value = input.rates[key];
    if (!Array.isArray(value) || value.length !== 2 || value.some(number => !finite(number) || number < 0 || number > 10000) || value[0] > value[1]) throw new CloudDataError();
    rates[key] = [...value];
  }
  return {
    days: input.days, people: input.people, budget: input.budget, originId: input.originId,
    interests: [...input.interests], pace: input.pace, nationality: input.nationality,
    transport: input.transport, mustVisit: destinationIds(input.mustVisit, catalog),
    roundTrip: input.roundTrip, startDate: input.startDate, rates
  };
}

export function sanitizePlanPayload(input, catalog = CATALOG) {
  exactFields(input, PAYLOAD_KEYS, ['savedIds']);
  const savedIds = destinationIds(input.savedIds, catalog);
  const tripProfile = input.tripProfile === undefined || input.tripProfile === null ? null : validateCloudProfile(input.tripProfile, catalog);
  const tripStopIds = destinationIds(input.tripStopIds === undefined ? [] : input.tripStopIds, catalog);
  if (!tripProfile && tripStopIds.length) throw new CloudDataError('محطات البرنامج تحتاج تفضيلات الرحلة لإعادة حسابها.');
  const title = input.title === undefined ? 'رحلتي في درب' : input.title;
  if (typeof title !== 'string' || !title.trim() || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) throw new CloudDataError();
  return {savedIds, tripProfile, tripStopIds, title: title.trim()};
}

function timestampISO(value) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    date = new Date(value);
    if (!Number.isFinite(date.valueOf()) || date.toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) throw new CloudDataError();
  } else if (object(value) && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1000000000) {
    date = new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000));
    if (!Number.isFinite(date.valueOf())) throw new CloudDataError();
  } else throw new CloudDataError();
  return date.toISOString();
}

export function sanitizeStoredPlan(input, catalog = CATALOG) {
  exactFields(input, STORED_KEYS);
  if (input.version !== 1) throw new CloudDataError('هذه نسخة غير مدعومة من الرحلة السحابية.');
  const payload = sanitizePlanPayload({savedIds: input.savedIds, tripProfile: input.tripProfile, tripStopIds: input.tripStopIds, title: input.title}, catalog);


  return {version: 1, ...payload, updatedAt: timestampISO(input.updatedAt)};
}
