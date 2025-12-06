import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"

export default [
    {
        ignores: [
            "**/generated/**/*",
            "**/node_modules/**/*",
            "**/dist/**/*",
            "**/*.d.ts",
            "**/prisma/migrations/**/*"
        ]
    },
    {
        files: ["**/*.{js,ts}"],
        languageOptions: { globals: globals.node }
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "react/display-name": "off",
            indent: ["error", 4],
            "react-hooks/exhaustive-deps": "off",
            "linebreak-style": "off",
            quotes: ["error", "double"],
            semi: ["error", "never"],
            //temporarily off for testing cicd
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unsafe-function-type": "warn"
        },
    }
]