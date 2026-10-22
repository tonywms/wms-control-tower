import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      /*
       * O Control Tower utiliza carregamento assíncrono de APIs
       * disparado por useEffect em diversos componentes já
       * consolidados e funcionais.
       *
       * Durante a estabilização, essa regra fica desativada
       * para não exigir refatorações desnecessárias em fluxos
       * que já estão funcionando.
       */
      "react-hooks/set-state-in-effect": "off",

      /*
       * Algumas APIs e componentes ainda trabalham com respostas
       * do Supabase sem os Database Types gerados globalmente.
       *
       * Durante a estabilização, permitimos explicit any.
       * Depois podemos tipar o banco oficialmente e reativar
       * esta regra.
       */
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    /*
     * Arquivos de backup/cópias locais não devem participar
     * do lint nem do build oficial.
     */
    "**/*.backup.*",
    "**/*.backup-*",
    "**/* copy.ts",
    "**/* copy.tsx",
    "**/* copy.js",
    "**/* copy.jsx",
  ]),
]);

export default eslintConfig;