import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  const masterUsername = process.env.MASTER_USERNAME || "admin";
  const masterPassword = process.env.MASTER_PASSWORD || "changeme123";

  const existing = db.select().from(users).where(eq(users.role, "master")).get();

  if (existing) {
    console.log("Master account already exists, skipping seed.");
    return;
  }

  const hashedPassword = await bcrypt.hash(masterPassword, 12);

  db.insert(users).values({
    username: masterUsername,
    password: hashedPassword,
    role: "master",
    status: "approved",
  }).run();

  console.log(`Master account "${masterUsername}" created.`);
}

seed().catch(console.error);
