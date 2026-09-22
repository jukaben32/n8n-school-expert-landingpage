import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `.toISOString().split('T')[0]` calcula la fecha en UTC, que ya es el
    // día siguiente entre las 8pm y medianoche hora de RD -- corrigió esto
    // 8 veces en un mismo commit (ver lib/schoolDate.ts) porque nada impedía
    // que volviera a aparecer. Usar `schoolDateString()` / `todaySchoolDate()`
    // de `@/lib/schoolDate` en su lugar.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "No uses .toISOString().split('T')[0] para la fecha del colegio -- calcula en UTC, no en hora de RD (bug real entre 8pm y medianoche). Usa schoolDateString(d) o todaySchoolDate() de '@/lib/schoolDate'.",
        },
      ],
    },
  },
]);

export default eslintConfig;
