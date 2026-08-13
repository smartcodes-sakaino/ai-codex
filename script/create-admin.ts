import "dotenv/config";
import { lmsStorage } from "../server/lms/storage";
import { hashPassword, generateTempPassword } from "../server/lms/auth";

async function main() {
  const [, , email, name] = process.argv;
  if (!email || !name) {
    console.error("Usage: tsx script/create-admin.ts <email> <name>");
    process.exit(1);
  }

  const existing = await lmsStorage.getUserByEmail(email);
  if (existing) {
    console.error(`User already exists: ${email}`);
    process.exit(1);
  }

  const password = generateTempPassword();
  const passwordHash = await hashPassword(password);
  const user = await lmsStorage.createUser({
    name,
    email,
    role: "admin",
    passwordHash,
    tempPassword: password,
    groupIds: [],
  });

  console.log("Admin user created:");
  console.log(`  email: ${user.email}`);
  console.log(`  password: ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
