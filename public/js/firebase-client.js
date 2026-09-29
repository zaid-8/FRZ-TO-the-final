import {FIREBASE_CONFIG, APP_CHECK_SITE_KEY, AI_MODEL, FIREBASE_SDK_VERSION} from './firebase-config.js';
import {CATALOG} from './catalog.js';
import {sanitizePlanPayload, sanitizeStoredPlan, CloudDataError} from './cloud-model.js';

export const FIREBASE_SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId', 'databaseURL'];

export class CloudError extends Error {
  constructor(code, message) {super(message); this.name = 'CloudError'; this.code = code;}
}

function publicError(error) {
  if (error instanceof CloudError || error instanceof CloudDataError) return error;
  const code = typeof error?.code === 'string' ? error.code : '';
  if (['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(code)) return new CloudError('CLOUD_ACCOUNT_CONFLICT', 'حساب Google مرتبط بحساب سحابي آخر. اختر تبديل الحساب صراحة؛ لن ننقل أو ندمج أي بيانات تلقائيًا.');
  if (code === 'auth/account-exists-with-different-credential') return new CloudError('CLOUD_PROVIDER_CONFLICT', 'هذا الحساب يستخدم طريقة دخول مختلفة. اختر حساب Google آخر أو راجع إعدادات الدخول.');
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code)) return new CloudError('CLOUD_CANCELLED', 'أُلغيت نافذة تسجيل الدخول. لم نغيّر رحلتك المحلية.');
  if (code === 'auth/popup-blocked') return new CloudError('CLOUD_POPUP_BLOCKED', 'المتصفح منع نافذة Google. اسمح بالنافذة ثم اضغط تسجيل الدخول مرة ثانية.');
  if (code === 'auth/unauthorized-domain') return new CloudError('CLOUD_DOMAIN_NOT_ALLOWED', 'نطاق الموقع غير مضاف ضمن نطاقات Firebase Authentication المسموحة.');
  if (code === 'auth/operation-not-allowed') return new CloudError('CLOUD_PROVIDER_DISABLED', 'طريقة الدخول غير مفعّلة في مشروع Firebase. يحتاج المشغّل إلى تفعيلها.');
  if (['permission-denied', 'firestore/permission-denied'].includes(code)) return new CloudError('CLOUD_PERMISSION_DENIED', 'Firebase رفض الوصول. راجع تسجيل الدخول وقواعد Firestore وإعداد App Check.');
  if (['unavailable', 'firestore/unavailable', 'auth/network-request-failed', 'deadline-exceeded', 'firestore/deadline-exceeded'].includes(code)) return new CloudError('CLOUD_UNAVAILABLE', 'تعذّر الوصول إلى Firebase الآن. لم يصل تأكيد من السحابة؛ احتفظ بنسختك المحلية.');
  if (['auth/too-many-requests', 'resource-exhausted'].includes(code)) return new CloudError('CLOUD_RATE_LIMIT', 'وصلت الخدمة إلى حد الطلبات. انتظر قليلًا وحاول مرة أخرى.');
  return new CloudError('CLOUD_REQUEST_FAILED', 'تعذّر إكمال طلب Firebase. راجع الاتصال وإعداد المشروع وحاول مرة أخرى.');
}

function validateFirebaseConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CloudError('CLOUD_NOT_CONFIGURED', 'الحفظ السحابي غير مفعّل لهذا الموقع بعد. رحلتك المحلية ما زالت متاحة.');
  const config = {};
  for (const key of CONFIG_KEYS) {
    const value = input[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || value.length > 512 || /[\s\u0000-\u001f\u007f]/.test(value)) throw new CloudError('CLOUD_INVALID_CONFIG', 'إعداد Firebase العام غير مكتمل أو غير صالح. يحتاج المشغّل إلى مراجعته.');
    config[key] = value;
  }
  if (!['apiKey', 'authDomain', 'projectId', 'appId'].every(key => config[key])) throw new CloudError('CLOUD_INVALID_CONFIG', 'إعداد Firebase يحتاج apiKey وauthDomain وprojectId وappId من إعداد تطبيق الويب.');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(config.projectId) || !/^[A-Za-z0-9.-]+$/.test(config.authDomain)) throw new CloudError('CLOUD_INVALID_CONFIG', 'معرّف مشروع Firebase أو نطاق تسجيل الدخول غير صالح.');
  return config;
}

export async function resolveFirebaseConfig({explicit = FIREBASE_CONFIG, fetchImpl = globalThis.fetch, timeoutMs = 6000} = {}) {
  if (Object.values(explicit || {}).some(value => typeof value === 'string' && value.trim())) return validateFirebaseConfig(explicit);
  if (typeof fetchImpl !== 'function' || globalThis.location?.protocol === 'file:') throw new CloudError('CLOUD_NOT_CONFIGURED', 'الحفظ السحابي غير مفعّل هنا. شغّل الموقع عبر Firebase Hosting أو أضف إعداد تطبيق الويب العام.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/__/firebase/init.json', {signal: controller.signal, cache: 'no-store', credentials: 'same-origin', headers: {Accept: 'application/json'}});
    if (!response.ok) throw new CloudError('CLOUD_NOT_CONFIGURED', 'لم يُضبط مشروع Firebase لهذا الموقع بعد. التخطيط المحلي متاح.');
    return validateFirebaseConfig(await response.json());
  } catch (error) {
    if (error instanceof CloudError) throw error;
    throw new CloudError('CLOUD_NOT_CONFIGURED', 'تعذّر قراءة إعداد Firebase. افتح النسخة المنشورة أو راجع الاتصال وإعداد المشروع.');
  } finally {clearTimeout(timer);}
}

async function loadFirebaseModules({appCheckConfigured}) {
  const [app, auth, firestore, appCheck] = await Promise.all([
    import(`${FIREBASE_SDK_BASE}/firebase-app.js`),
    import(`${FIREBASE_SDK_BASE}/firebase-auth.js`),
    import(`${FIREBASE_SDK_BASE}/firebase-firestore.js`),
    appCheckConfigured ? import(`${FIREBASE_SDK_BASE}/firebase-app-check.js`) : Promise.resolve(null)
  ]);
  return {app, auth, firestore, appCheck};
}


export function createFirebaseClient({resolveConfig = resolveFirebaseConfig, loadModules = loadFirebaseModules, appCheckSiteKey = APP_CHECK_SITE_KEY, aiModel = AI_MODEL, catalog = CATALOG, initializationTimeoutMs = 18000, writeTimeoutMs = 15000, isOnline = () => globalThis.navigator?.onLine !== false} = {}) {
  const listeners = new Set();
  let context = null, pendingContext = null, authUnsubscribe = null, appCheckInstance = null, authBusy = false, pendingWrite = null, authEpoch = 0, attempt = 0, lastUid = null;
  let state = {phase: 'idle', uid: null, isAnonymous: false, displayName: null, error: null, appCheckConfigured: false, writePending: false};
  const snapshot = () => ({...state, error: state.error ? {...state.error} : null});
  const emit = update => {
    state = {...state, ...update};
    for (const listener of listeners) {try {listener(snapshot());} catch {                                          }}
  };
  const userView = user => ({uid: user?.uid || null, isAnonymous: Boolean(user?.isAnonymous), displayName: typeof user?.displayName === 'string' ? user.displayName.slice(0, 100) : null});
  const updateUser = user => {
    const uid = user?.uid || null;
    if (uid !== lastUid) {authEpoch += 1; lastUid = uid;}
    emit({...userView(user), phase: user ? 'signed-in' : 'ready', error: null});
  };
  const fail = error => {
    const safe = publicError(error);
    emit({phase: safe.code === 'CLOUD_NOT_CONFIGURED' || safe.code === 'CLOUD_INVALID_CONFIG' ? 'unconfigured' : 'error', error: {code: safe.code, message: safe.message}});
    return safe;
  };

  async function getFirebaseContext() {
    if (context) return context;
    if (pendingContext) return pendingContext;
    const id = ++attempt;
    emit({phase: 'connecting', error: null});
    let timer, unsubscribeForAttempt;
    const current = () => {if (id !== attempt) throw new CloudError('CLOUD_INIT_TIMEOUT', 'تأخر تحميل Firebase. تحقّق من الاتصال وحاول مرة أخرى.');};
    const initialize = async () => {
      const config = validateFirebaseConfig(await resolveConfig());
      current();
      const hasSiteKey = typeof appCheckSiteKey === 'string' && appCheckSiteKey.trim().length > 0 && appCheckSiteKey.length <= 512 && !/\s/.test(appCheckSiteKey);
      const modules = await loadModules({sdkBase: FIREBASE_SDK_BASE, appCheckConfigured: hasSiteKey});
      current();
      let app = modules.app.getApps().find(item => item.name === 'darb');
      if (app && ['apiKey', 'projectId', 'appId', 'authDomain'].some(key => app.options[key] !== config[key])) throw new CloudError('CLOUD_INVALID_CONFIG', 'يوجد تطبيق Firebase آخر بإعداد مختلف. أعد تحميل الصفحة بعد مراجعة إعداد المشروع.');
      if (!app) app = modules.app.initializeApp(config, 'darb');
      let appCheckError = null;
      if (hasSiteKey && !appCheckInstance) {
        try {
          appCheckInstance = modules.appCheck.initializeAppCheck(app, {provider: new modules.appCheck.ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true});
        } catch {
          appCheckError = {code: 'CLOUD_APPCHECK_FAILED', message: 'تعذّر تهيئة App Check. يحتاج المشغّل إلى مراجعة مفتاح الموقع العام.'};
        }
      }
      const auth = modules.auth.getAuth(app), db = modules.firestore.getFirestore(app);
      const candidate = {app, auth, db, modules, config, appCheck: appCheckInstance, appCheckConfigured: Boolean(appCheckInstance), appCheckError, aiModel, sdkVersion: FIREBASE_SDK_VERSION, sdkBase: FIREBASE_SDK_BASE};
      emit({appCheckConfigured: candidate.appCheckConfigured});

      await new Promise((resolve, reject) => {
        unsubscribeForAttempt = modules.auth.onAuthStateChanged(auth, user => {
          if (id !== attempt) return;
          updateUser(user);
          resolve();
        }, error => reject(publicError(error)));
      });
      current();
      authUnsubscribe = unsubscribeForAttempt;
      context = candidate;
      return context;
    };
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        if (id === attempt) attempt += 1;
        unsubscribeForAttempt?.();
        reject(new CloudError('CLOUD_INIT_TIMEOUT', 'تأخر تحميل Firebase. تحقّق من الاتصال وحاول مرة أخرى.'));
      }, initializationTimeoutMs);
    });
    pendingContext = Promise.race([initialize(), timeout]).catch(error => {
      unsubscribeForAttempt?.();
      pendingContext = null;
      throw fail(error);
    }).finally(() => clearTimeout(timer));
    return pendingContext;
  }

  function ensureOnline() {
    if (!isOnline()) throw new CloudError('CLOUD_OFFLINE', 'أنت غير متصل بالإنترنت. احفظ النسخة المحلية؛ لم يُرسل طلب إلى السحابة.');
  }
  function identity(ctx) {
    const user = ctx.auth.currentUser;
    if (!user || typeof user.uid !== 'string' || !user.uid || user.uid.length > 128 || user.uid.includes('/')) throw new CloudError('CLOUD_AUTH_REQUIRED', 'اتصل بالسحابة كضيف أو سجّل الدخول بحساب Google أولًا.');
    return {uid: user.uid, epoch: authEpoch};
  }
  function sameIdentity(ctx, before) {
    if (ctx.auth.currentUser?.uid !== before.uid || authEpoch !== before.epoch) throw new CloudError('CLOUD_AUTH_CHANGED', 'تغيّر الحساب أثناء الطلب. لم نطبّق النتيجة؛ أعد المحاولة بالحساب الحالي.');
  }
  async function writeWithAcknowledgement(operation) {
    if (pendingWrite) throw new CloudError('CLOUD_WRITE_PENDING', 'يوجد طلب سحابي لم ينتهِ بعد. انتظر تأكيده قبل حفظ أو حذف نسخة أخرى.');
    const token = {};
    pendingWrite = token;
    emit({writePending: true});


    const running = Promise.resolve().then(operation);
    const release = () => {if (pendingWrite === token) {pendingWrite = null; emit({writePending: false});}};
    running.then(release, release);
    let timer;
    try {
      return await Promise.race([running, new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new CloudError('CLOUD_WRITE_UNCONFIRMED', 'لم يصل تأكيد من Firebase بعد. الطلب ما زال قيد المعالجة وقد يكتمل لاحقًا؛ لا تعتبره محفوظًا أو ملغيًا، وتحقّق من النسخة السحابية قبل تكراره.')), writeTimeoutMs);
      })]);
    } finally {clearTimeout(timer);}
  }
  async function authAction(action, {online = true} = {}) {
    if (authBusy) throw new CloudError('CLOUD_BUSY', 'طلب تسجيل الدخول السابق لم ينتهِ بعد.');
    authBusy = true;
    try {
      if (online) ensureOnline();
      const ctx = await getFirebaseContext();
      emit({phase: 'connecting', error: null});
      const result = await action(ctx);
      updateUser(ctx.auth.currentUser);
      return result;
    } catch (error) {throw fail(error);} finally {authBusy = false;}
  }
  const connectGuest = () => authAction(async ctx => {
    if (!ctx.auth.currentUser) await ctx.modules.auth.signInAnonymously(ctx.auth);
    return userView(ctx.auth.currentUser);
  });
  const signInGoogle = ({replaceAnonymous = false} = {}) => authAction(async ctx => {
    const provider = new ctx.modules.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt: 'select_account'});
    if (ctx.auth.currentUser?.isAnonymous && !replaceAnonymous) {

      await ctx.modules.auth.linkWithPopup(ctx.auth.currentUser, provider);
    } else {

      await ctx.modules.auth.signInWithPopup(ctx.auth, provider);
    }
    return userView(ctx.auth.currentUser);
  });
  const signOutCloud = () => authAction(async ctx => {
    await ctx.modules.auth.signOut(ctx.auth);
    return {signedOut: true};
  }, {online: false});

  async function saveCloudTrip(input) {
    try {
      const plan = sanitizePlanPayload(input, catalog);
      ensureOnline();
      const ctx = await getFirebaseContext(), before = identity(ctx), sdk = ctx.modules.firestore;
      const ref = sdk.doc(ctx.db, 'users', before.uid, 'plans', 'current');


      await writeWithAcknowledgement(() => sdk.runTransaction(ctx.db, async transaction => {
        await transaction.get(ref);
        sameIdentity(ctx, before);
        transaction.set(ref, {version: 1, ...plan, updatedAt: sdk.serverTimestamp()});
      }, {maxAttempts: 3}));
      sameIdentity(ctx, before);
      emit({phase: 'signed-in', error: null});
      return {saved: true, plan: {version: 1, ...plan}};
    } catch (error) {throw fail(error);}
  }

  async function loadCloudTrip() {
    try {
      ensureOnline();
      const ctx = await getFirebaseContext(), before = identity(ctx), sdk = ctx.modules.firestore;
      const result = await sdk.getDocFromServer(sdk.doc(ctx.db, 'users', before.uid, 'plans', 'current'));
      sameIdentity(ctx, before);
      if (result.metadata?.fromCache || result.metadata?.hasPendingWrites) throw new CloudError('CLOUD_UNCONFIRMED_READ', 'لم تصل نسخة مؤكدة من خادم Firebase. لم نغيّر رحلتك المحلية.');
      const plan = result.exists() ? sanitizeStoredPlan(result.data(), catalog) : null;
      emit({phase: 'signed-in', error: null});
      return plan;
    } catch (error) {throw fail(error);}
  }

  async function deleteCloudTrip() {
    try {
      ensureOnline();
      const ctx = await getFirebaseContext(), before = identity(ctx), sdk = ctx.modules.firestore;
      const ref = sdk.doc(ctx.db, 'users', before.uid, 'plans', 'current');
      await writeWithAcknowledgement(() => sdk.runTransaction(ctx.db, async transaction => {
        await transaction.get(ref);
        sameIdentity(ctx, before);
        transaction.delete(ref);
      }, {maxAttempts: 3}));
      sameIdentity(ctx, before);
      emit({phase: 'signed-in', error: null});
      return {deleted: true};
    } catch (error) {throw fail(error);}
  }

  return {
    getFirebaseContext, connectGuest, signInGoogle, signOutCloud, saveCloudTrip, loadCloudTrip, deleteCloudTrip,
    getCloudState: snapshot,
    subscribeCloudState(callback) {
      if (typeof callback !== 'function') throw new TypeError('A cloud state callback is required.');
      listeners.add(callback);
      callback(snapshot());
      return () => listeners.delete(callback);
    },
    dispose() {attempt += 1; authUnsubscribe?.(); listeners.clear();}
  };
}

const client = createFirebaseClient();
export const getFirebaseContext = client.getFirebaseContext;
export const connectGuest = client.connectGuest;
export const signInGoogle = client.signInGoogle;
export const signOutCloud = client.signOutCloud;
export const saveCloudTrip = client.saveCloudTrip;
export const loadCloudTrip = client.loadCloudTrip;
export const deleteCloudTrip = client.deleteCloudTrip;
export const getCloudState = client.getCloudState;
export const subscribeCloudState = client.subscribeCloudState;
