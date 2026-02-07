module.exports = [
  {
    ignores: ["target/**", "keys/**", "assets/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        CustomEvent: "readonly",
        MutationObserver: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Response: "readonly",
        Blob: "readonly",
        JSON: "readonly",
        Number: "readonly",
        String: "readonly",
        Object: "readonly",
        Array: "readonly",
        Map: "readonly",
        Set: "readonly",
        WeakSet: "readonly",
        Math: "readonly",
        Promise: "readonly",
        chrome: "readonly"
      }
    },
    rules: {
      "no-redeclare": "error",
      eqeqeq: ["error", "always", { null: "ignore" }]
    }
  }
];
