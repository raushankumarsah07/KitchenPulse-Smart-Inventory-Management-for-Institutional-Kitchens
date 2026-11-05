// Fills the database with realistic demo data so the app can be shown to anyone.
//
//   npm run seed                 -> seeds only if the database is empty
//   npm run seed -- --fresh      -> wipes everything first, then seeds
//   npm run seed -- --days=120   -> choose how many days of history (default 90)
//
// Demo logins created:
//   manager: demo@kitchenpulse.in  /  Demo@1234
//   staff:   staff@kitchenpulse.in /  Demo@1234
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Batch, Consumption, Ingredient, User, Waste } from "./models.js";
import { seedDemo } from "./services/seed.js";

const fresh = process.argv.includes("--fresh");
const days =
  Number(
    (process.argv.find((a) => a.startsWith("--days=")) || "--days=90").split(
      "=",
    )[1],
  ) || 90;

await mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart_kitchen",
);
try {
  if (fresh) {
    await Promise.all(
      [Batch, Consumption, Waste, Ingredient, User].map((m) =>
        m.deleteMany({}),
      ),
    );
    console.log("Cleared existing data.");
  } else if (await Ingredient.exists({})) {
    console.log(
      'The database already has ingredients. Run "npm run seed -- --fresh" to wipe it and re-seed.',
    );
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash("Demo@1234", 10);
  const manager = await User.findOneAndUpdate(
    { email: "demo@kitchenpulse.in" },
    { name: "Asha Rao", passwordHash, role: "manager" },
    { upsert: true, new: true },
  );
  await User.findOneAndUpdate(
    { email: "staff@kitchenpulse.in" },
    { name: "Ravi Kumar", passwordHash, role: "staff" },
    { upsert: true },
  );

  const r = await seedDemo(manager._id, days);
  console.log(`Seeded ${days} days of demo data:`, r);
  console.log("\nLogin as manager:  demo@kitchenpulse.in / Demo@1234");
  console.log("Login as staff:    staff@kitchenpulse.in / Demo@1234");
} finally {
  await mongoose.disconnect();
}
