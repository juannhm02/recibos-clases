/* Service worker de avisos push (Firebase Cloud Messaging) */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyCjnnsWz-cSfkbnPGF-SNXSiuCJEYUhFaQ",
  authDomain: "recibos-clases.firebaseapp.com",
  projectId: "recibos-clases",
  storageBucket: "recibos-clases.firebasestorage.app",
  messagingSenderId: "203608699398",
  appId: "1:203608699398:web:d7bfeb7b64f2ec4d148987"
});
firebase.messaging();
/* Las notificaciones llegan con "notification" y "fcmOptions.link": el navegador las muestra y al tocarlas abre la app. */
