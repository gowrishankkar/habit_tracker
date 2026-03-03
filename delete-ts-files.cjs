/**
 * delete-ts-files.cjs
 * ────────────────────
 * Deletes .ts/.tsx files that have a .js/.jsx counterpart under apps/web/src.
 * The .js/.jsx files already contain the production content.
 *
 * Run from the project root:
 *   node delete-ts-files.cjs
 */

const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "apps/web/src");

// Each file listed here has an equivalent .js/.jsx that is kept.
const toDelete = [
  "main.tsx",
  "App.tsx",
  "app/store.ts",
  "app/hooks.ts",
  "lib/constants.ts",
  "lib/api.ts",
  "components/ProtectedRoute.tsx",
  "components/ui/Button.tsx",
  "components/ui/Input.tsx",
  "components/layout/Header.tsx",
  "components/layout/Layout.tsx",
  "features/auth/authApi.ts",
  "features/auth/authSlice.ts",
  "features/auth/LoginPage.tsx",
  "features/auth/RegisterPage.tsx",
  "features/habits/habitsApi.ts",
  "features/habits/habitsSlice.ts",
  "features/habits/HabitList.tsx",
  "features/habits/HabitForm.tsx",
];

let deleted = 0;
let skipped = 0;
let errors  = 0;

for (const file of toDelete) {
  const fullPath = path.join(ROOT, file);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Deleted  ${file}`);
      deleted++;
    } else {
      console.log(`Skipped  ${file} (already gone)`);
      skipped++;
    }
  } catch (e) {
    console.error(`Error    ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\nResult: ${deleted} deleted, ${skipped} skipped, ${errors} errors.`);
