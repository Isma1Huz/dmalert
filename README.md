# Team Alert

## 1. Deploy the server on Render
1. Push this folder to a GitHub repo (render.yaml must be at the repo root).
2. Render dashboard -> New -> Blueprint -> pick the repo -> Apply.
3. Open the service -> Environment -> copy AUTH_TOKEN.
4. Note the URL, e.g. https://team-alert-server.onrender.com
   (your URL may differ if the name is taken)

## 2. Configure each teammate's app (app/config.json)
- name:   the person's name
- server: wss://<your-render-host>   (note wss://, not https://)
- token:  the AUTH_TOKEN from Render

## 3. Run the app
cd app && npm install && npm start

## 4. Build a double-clickable Mac app
npm run build   (output in app/dist)

## Local testing
cd server && npm install && npm start, then use "ws://localhost:8080" and an empty token.
# dmalert
