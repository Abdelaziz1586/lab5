import { execFileSync, spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { URL } from 'url';

jest.setTimeout(30_000);

type ApiResponse = { status: number; body: any };

describe('Todo List API (e2e)', () => {
  let server: ChildProcess;
  let serverOutput = '';
  let port: number;
  let mongoUri: string;

  beforeAll(async () => {
    const parsedUri = new URL(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/todos',
    );
    parsedUri.pathname = `/lab5_e2e_${process.pid}`;
    mongoUri = parsedUri.toString();
    port = 32000 + (process.pid % 10_000);

    const childEnv = { ...process.env };
    delete childEnv.JEST_WORKER_ID;
    childEnv.MONGODB_URI = mongoUri;
    childEnv.JWT_SECRET = 'test-only-signing-secret';
    childEnv.PORT = String(port);

    server = spawn(
      process.execPath,
      ['-r', 'ts-node/register', 'src/main.ts'],
      { cwd: process.cwd(), env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    server.stdout?.on('data', (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString()}`.slice(-8000);
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString()}`.slice(-8000);
    });

    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (server.exitCode !== null) {
        throw new Error(
          `API process exited before becoming ready:\n${serverOutput}`,
        );
      }

      try {
        const response = await callApi('GET', '/');
        if (response.status === 200) {
          return;
        }
      } catch {
        // The application is still starting; retry the readiness request.
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`API did not become ready:\n${serverOutput}`);
  }, 30_000);

  afterAll(async () => {
    if (server && server.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          server.kill('SIGKILL');
          resolve();
        }, 5_000);
        server.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
        server.kill('SIGTERM');
      });
    }

    if (mongoUri) {
      const dropDatabase = [
        'const mongoose = require("mongoose");',
        'mongoose.connect(process.env.MONGODB_URI).then(async () => {',
        '  await mongoose.connection.dropDatabase();',
        '  await mongoose.disconnect();',
        '}).catch((error) => { console.error(error); process.exit(1); });',
      ].join('\n');

      try {
        execFileSync(process.execPath, ['-e', dropDatabase], {
          cwd: process.cwd(),
          env: { ...process.env, MONGODB_URI: mongoUri },
          stdio: 'ignore',
        });
      } catch {
        // A failed startup may leave no test database to clean up.
      }
    }
  });

  function callApi(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    token?: string,
  ): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      const serializedBody =
        body === undefined ? undefined : JSON.stringify(body);
      const headers: http.OutgoingHttpHeaders = {};
      if (serializedBody) {
        headers['content-type'] = 'application/json';
        headers['content-length'] = Buffer.byteLength(serializedBody);
      }
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }

      const req = http.request(
        { hostname: '127.0.0.1', port, path, method, headers },
        (response) => {
          let responseText = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            responseText += chunk;
          });
          response.on('end', () => {
            let responseBody: any = responseText;
            try {
              responseBody = JSON.parse(responseText);
            } catch {
              // Keep plain text response bodies as-is.
            }
            resolve({ status: response.statusCode ?? 0, body: responseBody });
          });
        },
      );
      req.on('error', reject);
      req.end(serializedBody);
    });
  }

  async function registerAndLogin(email: string): Promise<string> {
    const registration = await callApi('POST', '/account/register', {
      name: 'Test User',
      email,
      password: 'correct horse battery staple',
    });
    expect(registration.status).toBe(201);

    const login = await callApi('POST', '/account/login', {
      email,
      password: 'correct horse battery staple',
    });
    expect(login.status).toBe(201);
    return login.body.access_token as string;
  }

  it('registers accounts without exposing passwords and keeps login errors generic', async () => {
    const registration = await callApi('POST', '/account/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'correct horse battery staple',
    });
    expect(registration.status).toBe(201);
    expect(registration.body.password).toBeUndefined();
    expect(registration.body.role).toBe('user');

    const duplicate = await callApi('POST', '/account/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'correct horse battery staple',
    });
    expect(duplicate.status).toBe(409);

    const missingAccount = await callApi('POST', '/account/login', {
      email: 'missing@example.com',
      password: 'incorrect',
    });
    const wrongPassword = await callApi('POST', '/account/login', {
      email: 'test@example.com',
      password: 'incorrect',
    });
    expect(missingAccount.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(missingAccount.body.message).toEqual(wrongPassword.body.message);
  });

  it('enforces todo ownership, admin access, and logout revocation', async () => {
    const userToken = await registerAndLogin('user@example.com');
    const secondUserToken = await registerAndLogin('second@example.com');

    expect((await callApi('GET', '/todos')).status).toBe(401);
    expect(
      (
        await callApi(
          'POST',
          '/todos',
          { title: 'Private todo', owner: '507f1f77bcf86cd799439011' },
          userToken,
        )
      ).status,
    ).toBe(400);

    const createdTodo = await callApi(
      'POST',
      '/todos',
      { title: 'Private todo' },
      userToken,
    );
    expect(createdTodo.status).toBe(201);

    const secondUserTodos = await callApi(
      'GET',
      '/todos',
      undefined,
      secondUserToken,
    );
    expect(secondUserTodos.status).toBe(200);
    expect(secondUserTodos.body).toEqual([]);

    const todoPath = `/todos/${createdTodo.body._id}`;
    expect(
      (await callApi('GET', todoPath, undefined, secondUserToken)).status,
    ).toBe(403);
    expect(
      (
        await callApi(
          'PUT',
          todoPath,
          { title: 'Stolen todo' },
          secondUserToken,
        )
      ).status,
    ).toBe(403);
    expect(
      (await callApi('DELETE', todoPath, undefined, secondUserToken)).status,
    ).toBe(403);

    await callApi('POST', '/todos', { title: 'Second todo' }, secondUserToken);
    const promoteAdmin = [
      'const mongoose = require("mongoose");',
      'mongoose.connect(process.env.MONGODB_URI).then(async () => {',
      '  await mongoose.connection.collection("accounts").updateOne(',
      '    { email: "second@example.com" }, { $set: { role: "admin" } });',
      '  await mongoose.disconnect();',
      '}).catch((error) => { console.error(error); process.exit(1); });',
    ].join('\n');
    execFileSync(process.execPath, ['-e', promoteAdmin], {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI: mongoUri },
      stdio: 'ignore',
    });

    const adminLogin = await callApi('POST', '/account/login', {
      email: 'second@example.com',
      password: 'correct horse battery staple',
    });
    expect(adminLogin.status).toBe(201);
    const adminToken = adminLogin.body.access_token as string;

    const allTodos = await callApi('GET', '/todos', undefined, adminToken);
    expect(allTodos.status).toBe(200);
    expect(allTodos.body).toHaveLength(2);
    expect((await callApi('GET', todoPath, undefined, adminToken)).status).toBe(
      200,
    );

    expect(
      (await callApi('POST', '/account/logout', undefined, adminToken)).status,
    ).toBe(201);
    expect((await callApi('GET', '/todos', undefined, adminToken)).status).toBe(
      401,
    );
  });
});
