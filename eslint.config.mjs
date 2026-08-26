// eslint-config-next v16 ships native flat configs, so these are imported
// directly rather than through the @eslint/eslintrc FlatCompat shim (which
// crashes on this config's circular plugin references).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    // Prisma's generated client is machine-written and huge — linting it is
    // noise, and it is gitignored anyway.
    ignores: ["src/generated/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
