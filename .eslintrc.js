module.exports = {
  env: {
    node: true,
    es2021: true,
    es6: true,
  },
  extends: [
    "airbnb-base",
    "plugin:node/recommended",
    "plugin:promise/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["import", "node", "promise", "security", "prettier"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  rules: {
    // Formatting
    "prettier/prettier": ["error"],
    // General best practices
    "no-console": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-var": "error",
    "prefer-const": "error",
    "object-shorthand": "error",
    "prefer-template": "error",
    "no-duplicate-imports": "error",
    "no-shadow": "error",
    "no-param-reassign": ["error", { props: false }],
    // Node.js
    "node/no-unsupported-features/es-syntax": "off", // allow import/export
    "node/no-unpublished-require": "off",
    "node/no-missing-import": "off",
    // Import plugin
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
      },
    ],
    "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
    "import/no-unresolved": "off",
    // Promise plugin
    "promise/always-return": "off",
    "promise/catch-or-return": "warn",
    // Security plugin (manually enabled)
    "security/detect-object-injection": "off", // too strict for most bots
    "security/detect-possible-timing-attacks": "warn",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-non-literal-require": "warn",
    "security/detect-unsafe-regex": "warn",
    "security/detect-eval-with-expression": "warn",
    "security/detect-buffer-noassert": "warn",
    "security/detect-child-process": "warn",
    "security/detect-disable-mustache-escape": "warn",
    "security/detect-no-csrf-before-method-override": "warn",
    "security/detect-new-buffer": "warn",
    "security/detect-pseudoRandomBytes": "warn",
  },
  overrides: [
    {
      files: ["**/test/**", "**/*.test.js", "**/*.spec.js"],
      env: { mocha: true, jest: true },
      rules: {
        "no-unused-expressions": "off",
      },
    },
    {
      files: ["src/commands/**/*.js"],
      rules: {
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      },
    },
  ],
  settings: {
    node: {
      tryExtensions: [".js", ".json", ".node"],
    },
  },
};
