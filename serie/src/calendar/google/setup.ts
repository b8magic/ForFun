/** Developer setup for Google Calendar (short form of README.md in this folder). */
export const GOOGLE_SETUP = `# Google Calendar — setup

1. Google Cloud console: enable **Google Calendar API** in your project.
2. Google Auth Platform: user type *External*. While in *Testing*, add test users (refresh tokens expire after 7 days in Testing). Scopes: \`openid\`, \`userinfo.email\`, \`calendar.readonly\`, \`calendar.events\` (sensitive → verification for production).
3. Clients → **iOS** client, bundle id **app.serie.ios**. Copy the client id (no secret).
4. Optional (web verification): **Web application** client, origin and redirect URI \`http://localhost:8081\`.
5. Env (not secrets, inlined at build time):
   \`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=NNNN-xxxx.apps.googleusercontent.com\`
   \`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…\` (optional)
6. app.json — register the reversed client id as an iOS URL scheme (redirect \`com.googleusercontent.apps.NNNN-xxxx:/oauthredirect\`):
   \`"ios": { "bundleIdentifier": "app.serie.ios", "scheme": ["com.googleusercontent.apps.NNNN-xxxx"] }\`
7. Build a development build (EAS). Expo Go is not supported (Google rejects exp:// redirects).

Without the iOS client id the connection reports **not_configured**.`;
