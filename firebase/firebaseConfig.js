/* Firebase config (compat) - loaded via script tag. */
(function (global) {
  const firebaseConfig = {
    apiKey: "AIzaSyA6ofgVyixAHMatQsgR29NOifPidpPeeCU",
    authDomain: "krushivikas-e1a30.firebaseapp.com",
    databaseURL: "https://krushivikas-e1a30-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "krushivikas-e1a30",
    storageBucket: "krushivikas-e1a30.firebasestorage.app",
    messagingSenderId: "235965308205",
    appId: "1:235965308205:web:7fd1dc60282c24ba8f07a4"
  };

  global.KV_FIREBASE_CONFIG = firebaseConfig;

  if (!global.firebase || !global.firebase.initializeApp) {
    console.error('[Firebase] Compat SDK scripts are not loaded.');
    return;
  }

  try {
    global.firebaseApp = global.firebase.apps.length
      ? global.firebase.app()
      : global.firebase.initializeApp(firebaseConfig);

    const db = global.firebase.database();
    global.firebaseDB = db;
    global.kv_db = db;
    console.log('[Firebase] Realtime Database connected.');
  } catch (error) {
    console.error('[Firebase] Connection failed:', error);
  }
})(window);
