import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  // These components synchronize browser storage and mutate Three.js scene refs;
  // React Compiler diagnostics do not model those imperative APIs. Compiler is off.
  { rules: { "react-hooks/set-state-in-effect": "off", "react-hooks/refs": "off", "react-hooks/immutability": "off" } },
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
];

export default config;
