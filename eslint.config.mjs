import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // Browser extension files
  files: ["extension/**/*.js"],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    globals: {
      // Browser APIs
      window: "readonly",
      document: "readonly",
      console: "readonly",
      setTimeout: "readonly",
      setInterval: "readonly",
      clearTimeout: "readonly",
      clearInterval: "readonly",
      navigator: "readonly",
      MutationObserver: "readonly",
      WebSocket: "readonly",
      chrome: "readonly",
      fetch: "readonly",
      URL: "readonly",
      FormData: "readonly",
      localStorage: "readonly",
      // Node.js APIs (for extension build tools)
      module: "readonly",
      require: "readonly",
    }
  },
  rules: {
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "prefer-const": "warn",
    "no-var": "off", // Allow var for broader browser compatibility
    "prefer-arrow-callback": "off",
    "object-shorthand": "off",
    "quote-props": "off",
    "comma-dangle": "off",
    "semi": ["warn", "always"],
    "no-undef": "off", // Browser globals are handled above
    "no-empty": "off",
    "no-case-declarations": "off",
    "no-useless-escape": "off",
  }
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "desktop/**"]
}];

export default eslintConfig;
