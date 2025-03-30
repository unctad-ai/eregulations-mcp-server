# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.7](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.6...v0.2.7) (2025-03-30)


### Bug Fixes

* update Dockerfile to fix "Could not locate the bindings file." for better-sqlite3 library ([fe40663](https://github.com/unctad-ai/eregulations-mcp-server/commit/fe406638743345ea2c1446ef80acc64014f25d9b))
* update startCommand args to include API URL and remove unnecessary environment variables ([7909bbc](https://github.com/unctad-ai/eregulations-mcp-server/commit/7909bbc5d46be96ea90a120a016ee86bda9ffd98))

### [0.2.6](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.5...v0.2.6) (2025-03-29)


### Code Refactoring

* update Logger to use named import for Socket and disable socket logging in test environment ([d5b7197](https://github.com/unctad-ai/eregulations-mcp-server/commit/d5b71978f8844fbcccbf852ac50a0d68551d212d))

### [0.2.5](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.4...v0.2.5) (2025-03-29)


### Bug Fixes

* fix console logs interference with the protocol communication causing JSON parsing error handling ([46d27b7](https://github.com/unctad-ai/eregulations-mcp-server/commit/46d27b7751673ccf7350e63afd1cddbacf1aefb3))

### [0.2.4](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.3...v0.2.4) (2025-03-29)


### Features

* remove SSE transport support to focus on stdio transport for better ES module compatibility ([7a2b7cc](https://github.com/unctad-ai/eregulations-mcp-server/commit/7a2b7cc78be7e5af9eb25de37b290245ff85b8c8))

### [0.2.3](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.2...v0.2.3) (2025-03-29)


### ⚠ BREAKING CHANGES

* removed SSE transport support to focus exclusively on stdio transport for better ES module compatibility

### Bug Fixes

* switch from CommonJS require.main detection to ES modules import.meta.url pattern ([0abdfa3](https://github.com/unctad-ai/eregulations-mcp-server/commit/0abdfa3e70b1c6db171e799dab390c47e8a0d52c))

### [0.2.2](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.1...v0.2.2) (2025-03-29)


### Features

* add command-line argument support for eRegulations API URL configuration ([1dca1b8](https://github.com/unctad-ai/eregulations-mcp-server/commit/1dca1b89d63b52e585d4e1e1d5f905b2306e8b7c))


### Bug Fixes

* completely revise coverage badge approach to update README directly with shields.io URL ([e5a38f0](https://github.com/unctad-ai/eregulations-mcp-server/commit/e5a38f00db7dc40186d52d45ed5420259482d616))
* enhance error handling and environment variable management in test client ([58d0dae](https://github.com/unctad-ai/eregulations-mcp-server/commit/58d0dae2fe5c1dae493dac364d63a82bfd05c4e0))
* extract coverage percentage directly from vitest output instead of relying on coverage files ([55ae0eb](https://github.com/unctad-ai/eregulations-mcp-server/commit/55ae0eb13a5c91c940a60240aa92d7948aa81f70))
* improve coverage extraction to handle potential Vitest exit codes ([96e4182](https://github.com/unctad-ai/eregulations-mcp-server/commit/96e41821587168cbdeb1a3898aae33948d3756c1))
* remove outdated coverage badge and summary files ([761ed40](https://github.com/unctad-ai/eregulations-mcp-server/commit/761ed404cfd1c69b3018bc05dd9ee594c5aadf20))
* simplify coverage approach to focus on threshold verification without badge ([968b3e9](https://github.com/unctad-ai/eregulations-mcp-server/commit/968b3e9eee9fa72bb15c8ebe67e603c1395930f8))
* update coverage badge system to use static SVG badge instead of dynamic JSON processing ([3a9edf2](https://github.com/unctad-ai/eregulations-mcp-server/commit/3a9edf2cc6924c2cafab3ab339aef86634b5aa21))
* update coverage scripts to ensure proper summary generation and install dependencies ([25cf9ca](https://github.com/unctad-ai/eregulations-mcp-server/commit/25cf9caa690c5a5080653328a4295388053403df))
* use direct git commands in GitHub Actions workflow to force-add coverage files ([b6172eb](https://github.com/unctad-ai/eregulations-mcp-server/commit/b6172eb2d8443533e669c5e48eac8737224e7d07))
* use EndBug/add-and-commit action with proper permissions for GitHub Actions ([50ceb99](https://github.com/unctad-ai/eregulations-mcp-server/commit/50ceb99f9ad247cdc8083b8cab8de8a8c4421aab))
* use standard bash comparison in GitHub Actions workflow for coverage badge color ([61b151a](https://github.com/unctad-ai/eregulations-mcp-server/commit/61b151acae9c2c9e9e7e41749766f5f459fccfed))


### Maintenance

* update coverage badge in README [skip ci] ([16dc4ba](https://github.com/unctad-ai/eregulations-mcp-server/commit/16dc4ba5261eaed0bef6b792385bb013eb2dd0f8))
* update gitignore to track coverage summary for badge ([2ff07f0](https://github.com/unctad-ai/eregulations-mcp-server/commit/2ff07f0299e9f37bbd71c243a98ed691e3c951d0))


### Tests

* update tests to cover command-line arguments for API URL ([e5f315e](https://github.com/unctad-ai/eregulations-mcp-server/commit/e5f315e1261674f3196a2ff3b3bbabd4a4269daf))

### [0.2.1](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.2.0...v0.2.1) (2025-03-28)


### Features

* add GitHub Actions workflow for test coverage and update README with coverage badge; improve coverage reporting script and configuration ([051dfc9](https://github.com/unctad-ai/eregulations-mcp-server/commit/051dfc9a2dcb732fe51c718b8146899694068c0d))


### Tests

* Add unit tests for SSE, TTLCache, DB cache, and Logger utilities ([44f48b3](https://github.com/unctad-ai/eregulations-mcp-server/commit/44f48b3c39ac2f236d5d7bdc114f7555d52c063e))

## [0.2.0](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.12...v0.2.0) (2025-03-28)


### Features

* add test coverage command and configuration ([7371108](https://github.com/unctad-ai/eregulations-mcp-server/commit/7371108ef1ec245277c58bfebec0a4ba584ecbba))
* refactor ERegulationsApi to support lazy-loading of API URL and improve cache management; update handler descriptions for clarity ([91ef8e2](https://github.com/unctad-ai/eregulations-mcp-server/commit/91ef8e2367a26d92cd4520f65c9bb03ea5ea68ca))


### Tests

* add unit tests for SqliteCache functionality including set, get, updateNamespace, and cleanExpired methods ([1c90a00](https://github.com/unctad-ai/eregulations-mcp-server/commit/1c90a00815cde456776f9233b86486ed772b4aa9))

### [0.1.12](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.11...v0.1.12) (2025-03-28)


### Features

* update Dockerfile for improved build process and add runtime dependencies; enhance logging in sse.ts ([822ff91](https://github.com/unctad-ai/eregulations-mcp-server/commit/822ff91fa8ad1a58a985d59fdb14eaa08c31c582))

### [0.1.11](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.10...v0.1.11) (2025-03-28)


### Features

* add configuration for smithery.ai deployment ([266ce44](https://github.com/unctad-ai/eregulations-mcp-server/commit/266ce440664a9e0a734d9912c14afa1e3176f573))

### [0.1.10](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.9...v0.1.10) (2025-03-20)


### Bug Fixes

* enhance documentation for procedure and step retrieval with detailed examples and parameters ([138109e](https://github.com/unctad-ai/eregulations-mcp-server/commit/138109e91754bd4a2d990b5f0ebc8b1d89466ac3))
* update descriptions to include API base URL for better context ([dfccfe0](https://github.com/unctad-ai/eregulations-mcp-server/commit/dfccfe03d927614ab6898617ae4e623ec07c456e))

### [0.1.9](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.8...v0.1.9) (2025-03-18)


### Bug Fixes

* add npm link to package.json ([a9f9e9c](https://github.com/unctad-ai/eregulations-mcp-server/commit/a9f9e9ce90c01ac6ee11d939e86a6c8397a4c33e))

### [0.1.8](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.7...v0.1.8) (2025-03-18)


### Bug Fixes

* add validation for procedure and step IDs in API methods ([f388c9b](https://github.com/unctad-ai/eregulations-mcp-server/commit/f388c9b563c09a13924c2ef46491903cf4b0c545))
* update mcp-inspector script to use latest version ([f926f30](https://github.com/unctad-ai/eregulations-mcp-server/commit/f926f301e7a1baadf207318ee6562156f3be681a))


### Code Refactoring

* remove unused API calls ([3ebacea](https://github.com/unctad-ai/eregulations-mcp-server/commit/3ebacea1bc008afa06541931283cf1c201d8ed6c))

### [0.1.7](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.6...v0.1.7) (2025-03-18)


### Bug Fixes

* correct bin path in package.json and add logging for server startup in index.ts ([b6d5af3](https://github.com/unctad-ai/eregulations-mcp-server/commit/b6d5af3db24ef504c790199f607b58f37e434293))

### [0.1.6](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.5...v0.1.6) (2025-03-18)


### Bug Fixes

* update mcp-inspector script for correct execution and remove unused start and dev scripts ([eabde9c](https://github.com/unctad-ai/eregulations-mcp-server/commit/eabde9c52f2f571e5022c6963aaa2596ab81c2b3))
* update postbump script in package.json for consistency with versioning process ([127df82](https://github.com/unctad-ai/eregulations-mcp-server/commit/127df82ca8dffb99f026ff4b47255c2067a6397f))

### [0.1.5](https://github.com/unctad-ai/eregulations-mcp-server/compare/v0.1.4...v0.1.5) (2025-03-18)


### Bug Fixes

* update package.json to ensure executable permissions and improve file inclusion ([6341009](https://github.com/unctad-ai/eregulations-mcp-server/commit/634100927fe7d3f3accb6f2182ede3f3da3c1657))


### Maintenance

* **release:** 0.1.4 ([9060153](https://github.com/unctad-ai/eregulations-mcp-server/commit/9060153276551a58789268b2d94d62fbb2e17019))
* **release:** 0.1.4 ([2fb3d0e](https://github.com/unctad-ai/eregulations-mcp-server/commit/2fb3d0eed6fae77272655a1e1d565c6c5878f004))
* update release scripts to use standard-version for versioning ([ff832da](https://github.com/unctad-ai/eregulations-mcp-server/commit/ff832da4e6cc9df7b467b96c88da2e3ea85c8669))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
