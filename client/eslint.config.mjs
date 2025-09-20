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
      // Relax strict rules to avoid blocking compile during development
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }
      ],
      "prefer-const": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        { "ts-ignore": "allow-with-description" }
      ],
      "@typescript-eslint/no-unsafe-function-type": "off",
      // Allow common TS/React expression patterns without erroring
      "no-unused-expressions": [
        "warn",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }
      ],
      "@typescript-eslint/no-unused-expressions": [
        "warn",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }
      ],
    },
  },
];

export default eslintConfig;
