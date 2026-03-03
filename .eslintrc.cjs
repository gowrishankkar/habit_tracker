/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  extends: [
    "eslint:recommended",
    "prettier", // must be last — disables rules that conflict with Prettier
  ],
  ignorePatterns: ["dist", "node_modules", "**/*.ts", "**/*.tsx"],
  overrides: [
    {
      // React-specific rules only apply to frontend code
      files: ["apps/web/**/*.{js,jsx}"],
      plugins: ["react", "react-hooks"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime", // React 18 JSX transform — no need to import React
        "plugin:react-hooks/recommended",
      ],
      settings: {
        react: { version: "detect" },
      },
    },
  ],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
};
