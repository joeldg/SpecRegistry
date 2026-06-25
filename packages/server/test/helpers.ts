import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../src/app.js";
import type { Db } from "../src/db.js";

export async function buildAdminTestApp(db: Db): Promise<FastifyInstance> {
  const app = await buildApp(db);
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "admin", password: "admin" },
  });
  const token = login.json().token as string;
  addDefaultAuth(app, token);
  return app;
}

export function addDefaultAuth(app: FastifyInstance, token: string): void {
  const original = app.inject.bind(app);
  app.inject = ((opts: Parameters<FastifyInstance["inject"]>[0], cb?: Parameters<FastifyInstance["inject"]>[1]) => {
    if (typeof opts === "string") return original(opts, cb as never) as unknown as LightMyRequestResponse;
    const headers = {
      authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    };
    return original({ ...opts, headers }, cb as never) as unknown as LightMyRequestResponse;
  }) as FastifyInstance["inject"];
}
