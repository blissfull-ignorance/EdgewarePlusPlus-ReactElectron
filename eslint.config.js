import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-electron/**",
      "release/**",
      "test-results/**",
      "playwright-report/**",
      "work/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["build/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      globals: {
        document: "readonly",
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        JSX: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        getComputedStyle: "readonly",
        MutationObserver: "readonly",
        React: "readonly",
        File: "readonly",
        HTMLInputElement: "readonly",
        HTMLAudioElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLVideoElement: "readonly",
        HTMLDivElement: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Audio: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        NodeJS: "readonly",
        Buffer: "readonly",
        Event: "readonly",
        MouseEvent: "readonly",
        // Runtime globals available in both Electron main (node ≥18) and the browser layer.
        Response: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortSignal: "readonly",
        ReadableStream: "readonly",
        fetch: "readonly",
        globalThis: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
