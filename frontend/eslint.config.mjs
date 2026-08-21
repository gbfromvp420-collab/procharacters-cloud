// Next 16 removed `next lint`; lint runs via the ESLint CLI (flat config).
// eslint-config-next 16 ships a native flat config array.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    // eslint-config-next 16 turns on the react-compiler-era react-hooks rules as
    // errors. They flag real (pre-existing) patterns but were never enforced
    // before this upgrade — keep them visible as warnings and fix incrementally
    // rather than block the Next 16 adoption on a large refactor.
    rules: {
      // `purity` is fully cleared and enforced as an error (see burndown PR).
      // The rest remain warnings pending manual-QA-backed passes on the hot
      // components (ChatApp/AccountSettings) — fix incrementally, then promote.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

