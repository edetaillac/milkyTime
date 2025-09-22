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
      // Assouplissements pragmatiques pour progression rapide
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      // Les textes UI peuvent contenir des apostrophes et guillemets
      "react/no-unescaped-entities": "off",
      // Laisser les hooks en warning pour ne pas bloquer
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
