// Offline operator command. Never loads an .env file or accepts a password in argv.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/admin-security";

try {
  if (process.env.ADMIN_OPERATOR_ACK !== "explicit-target-approved")
    throw new Error("Explicit target acknowledgement required");
  const [mode, username] = process.argv.slice(2);
  if (
    !["create", "reset"].includes(mode) ||
    !/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username ?? "")
  )
    throw new Error("Usage: admin-account.ts create|reset username");
  const passwordFile = process.env.ADMIN_PASSWORD_FILE;
  if (!passwordFile)
    throw new Error(
      "ADMIN_PASSWORD_FILE required; use a restricted temporary file, never command line arguments",
    );
  const password = (await readFile(passwordFile, "utf8")).replace(/\r?\n$/, "");
  const hashed = await hashPassword(password);
  await db.transaction(async (raw) => {
    const tx = raw as unknown as typeof db;
    if (mode === "create") {
      await tx.execute(
        sql`INSERT INTO admin_accounts(id,username,password_hash) VALUES(${randomUUID()},${username},${hashed})`,
      );
    } else {
      const a = (
        await tx.execute<{ id: string }>(
          sql`UPDATE admin_accounts SET password_hash=${hashed},totp_secret=NULL,pending_secret=NULL,pending_until=NULL,last_counter=-1,recovery_hashes='[]' WHERE username=${username} RETURNING id`,
        )
      ).rows[0];
      if (!a) throw new Error("Account not found");
      await tx.execute(sql`DELETE FROM admin_sessions WHERE admin_id=${a.id}`);
      await tx.execute(
        sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'operator_recovery')`,
      );
    }
  });
  console.log(
    "Account prepared. Sign in and confirm TOTP before panel access. Remove the restricted password file.",
  );
} catch {
  console.error(
    "Account operation failed. Check command, approved target, unique username and password file (14–256 characters).",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
