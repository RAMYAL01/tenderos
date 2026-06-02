import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Allow @ts-expect-error with descriptions, disallow @ts-ignore
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],

      // Warn on unused vars (don't error — too noisy during rapid development)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Allow explicit any in certain contexts (AI response parsing, etc.)
      "@typescript-eslint/no-explicit-any": "warn",

      // Enforce consistent imports
      "import/no-duplicates": "error",

      // React rules
      "react/no-unescaped-entities": "off",  // Allow apostrophes in JSX
      "react-hooks/exhaustive-deps": "warn",

      // Console — only warn (we use pino for structured logging)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    // Relax rules for config/migration files
    files: ["prisma/**/*.ts", "scripts/**/*.ts", "*.config.*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];

export default eslintConfig;
