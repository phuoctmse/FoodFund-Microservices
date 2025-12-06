module.exports = {
    moduleFileExtensions: ["js", "json", "ts"],
    rootDir: ".",
    testEnvironment: "node",
    testRegex: ".e2e-spec.ts$",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    roots: ["<rootDir>/apps/"],
    moduleNameMapper: {
        "^libs/aws-cognito$": "<rootDir>/libs/aws-cognito/index.ts",
        "^libs/aws-cognito/(.*)$": "<rootDir>/libs/aws-cognito/$1",
        "^libs/common$": "<rootDir>/libs/common/index.ts",
        "^libs/common/(.*)$": "<rootDir>/libs/common/$1",
        "^libs/databases$": "<rootDir>/libs/databases/index.ts",
        "^libs/databases/(.*)$": "<rootDir>/libs/databases/$1",
        "^libs/env$": "<rootDir>/libs/env/index.ts",
        "^libs/env/(.*)$": "<rootDir>/libs/env/$1",
        "^libs/graphql$": "<rootDir>/libs/graphql/index.ts",
        "^libs/graphql/(.*)$": "<rootDir>/libs/graphql/$1",
        "^libs/jwt$": "<rootDir>/libs/jwt/index.ts",
        "^libs/jwt/(.*)$": "<rootDir>/libs/jwt/$1",
    },
}
