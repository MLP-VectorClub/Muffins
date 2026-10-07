# Muffins

Web Socket server written in Node.js (using [socket.io](http://socket.io/)) for the [MLP Vector Club](https://github.com/MLP-VectorClub)'s website 

```
$ sudo npm install -g pm2
$ pnpm install
$ pnpm run build
$ cp .env.example .env  # then fill in the values
$ pm2 start pm2.json
```

## Who can connect

- **Winterchilla's visitors** are recognized by the `access` cookie, which is looked up in the `sessions` table of the database (`DB_NAME`, `mlpvc-rr` unless set).
- **Luna's front end (Celestia)** sends a one time token when it connects (`auth: { token }`, from Luna's `POST /users/me/socket-token`), and `LUNA_URL` is
  where the server asks Luna who it belongs to (`POST /internal/websocket/validate`, authorized with `WS_SERVER_KEY`). Without `LUNA_URL` such sockets are guests.
- The `origin` of every browser has to match `ORIGIN_REGEX`, e.g. `^https://(next\.)?mlpvector\.club$` for both front ends.

## Telling it about notifications

`POST /notify` with `Authorization: Bearer <WS_SERVER_KEY>` and `{"user": "<id>"}` makes the server send that user's open browsers the current unread count
(`notif-cnt`), which is what makes them look at their notifications again. Luna does this whenever a notification is sent or read (`WS_SERVER_URL` of Luna points
here, `http://127.0.0.1:3672`); nginx must not expose it (`setup/nginx.conf`).

