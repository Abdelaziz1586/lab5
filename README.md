# Todo List API

NestJS REST API with MongoDB persistence, account authentication, and private todos.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer

The app reads `MONGODB_URI` and `JWT_SECRET` from the environment or `.env` file. The MongoDB default is `mongodb://127.0.0.1:27017/todos`. A local-only JWT secret fallback is provided for development; set `JWT_SECRET` to a strong random value before exposing the app outside localhost.

To start a local database with Docker:

```bash
docker run --name lab5-mongo --publish 27017:27017 --detach \
  --env MONGO_INITDB_DATABASE=todos mongo:8.0
```

If the `lab5-mongo` container already exists, start it with `docker start lab5-mongo`.

## Install and run

```bash
npm ci
npm run start:dev
```

The API listens on `http://localhost:3000`.

## Account and todo routes

| Method   | Path                | Access                                                        |
| -------- | ------------------- | ------------------------------------------------------------- |
| `POST`   | `/account/register` | Public; creates a user account                                |
| `POST`   | `/account/login`    | Public; returns a one-hour JWT                                |
| `POST`   | `/account/logout`   | Bearer token required; revokes that token until expiry        |
| `POST`   | `/todos`            | Bearer token required; creates a todo for the current account |
| `GET`    | `/todos`            | Bearer token required; users see their todos, admins see all  |
| `GET`    | `/todos/:id`        | Owner or admin                                                |
| `PUT`    | `/todos/:id`        | Owner or admin                                                |
| `DELETE` | `/todos/:id`        | Owner or admin                                                |

Send protected requests with `Authorization: Bearer <access_token>`. Registration accepts `name`, `email`, and `password`; passwords must be at least eight characters. Roles are assigned by the server, so public registration always creates a `user` account. To promote an account in a local development database, update its `role` field to `admin` using MongoDB tooling.

## Validate

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```
