# Guilty Pleasure Web
React + TypeScript recreation of the Guilty Pleasure Flutter app, keeping Firebase Auth/Firestore data structures and appointment rules while giving the web UI a more polished responsive design.

## Run
```powershell
npm install
npm run dev
```

This project intentionally uses Vite 7.x rather than Vite 8/Rolldown because the original Windows environment was blocking the native Rolldown `.node` binding.

Firebase configuration is the same web configuration used by the original repository. Firestore collections/rules expected by the app are `users`, `usernames`, `appointments`, and `appointmentSlots`.

## Deploy To Netlify

1. Push this repository to GitHub. The local `.env` file is ignored and must never be committed.
2. Create a Netlify site from the GitHub repository. The included `netlify.toml` configures the build, publish folder, security headers, and serverless functions.
3. In Netlify, add the `VITE_FIREBASE_*` variables from your local `.env` file.
4. Add the server-only notification variables listed in `.env.example`: `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, and `FIREBASE_SERVICE_ACCOUNT_BASE64`. Do not add a `VITE_` prefix to these values.
5. Deploy Firestore rules separately with `firebase deploy --only firestore:rules`.

The browser app contains no notification-provider credentials. Appointment notifications are sent through the authenticated Netlify Function, which verifies Firebase ID tokens and permission before reading appointment data.
