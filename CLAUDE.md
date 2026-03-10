# CLAUDE.md — Wikilinker

## Project Overview

JavaScript project (Node.js server + browser extension) that auto-links Wikipedia entities on any webpage using bloom filters.

## Tech Stack

- **Server:** Node.js, Express, jsdom, Puppeteer, @mozilla/readability, DOMPurify, node-html-parser
- **Extension:** Browser extension (Chrome/Firefox/Safari), Manifest V3
- **Build:** esbuild for extension bundling
- **Tests:** Node.js built-in test runner (`node --test`)
- **Modules:** ES Modules throughout (`"type": "module"`)
- **Package manager:** npm

## Project Structure

- `/server` — Express proxy server
  - `/lib` — 18 core modules with co-located tests (`*.test.js`)
  - `/shared` — matcher-core, skip-rules, bloom filter
  - `/test-suite` — Integration test suite (runner, sampler, analyzer, reporter, screenshotter)
  - `/deploy` — Deployment config
- `/extension` — Browser extension
  - `/src` — Extension source
  - `/dist` — Built extension
  - `manifest.json`, `popup.js`, `styles.css`
- `/docs` — Documentation

## Commands

- `npm test` — Run all tests: `cd server && node --test lib/*.test.js shared/bloom.test.js test/*.test.js`
- `npm run build:extension` — Build browser extension via esbuild

## JavaScript Code Quality

- MUST use ES modules (`import`/`export`), NEVER CommonJS `require()`
- MUST use meaningful, descriptive variable and function names
- MUST use `camelCase` for functions/variables, `PascalCase` for classes, `UPPER_CASE` for constants
- NEVER use `var` — use `const` by default, `let` only when reassignment is needed
- MUST use `async`/`await` over raw Promises or callbacks
- MUST handle errors explicitly — NEVER swallow exceptions silently
- MUST use template literals for string interpolation
- NEVER use emoji or unicode that emulates emoji in code or comments
- Avoid redundant or tautological comments — code should be self-documenting
- Keep functions focused on a single responsibility
- Limit function parameters to 5 or fewer; use an options object for more
- MUST use strict equality (`===`) over loose equality (`==`)

## Testing

- Use Node.js built-in test runner (`node:test` and `node:assert`)
- Co-locate test files with source (`*.test.js` alongside `*.js`)
- NEVER delete test files
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies (HTTP, DOM)
- MUST run `npm test` before committing and verify all tests pass

## Browser Extension Guidelines

- Follow Manifest V3 conventions
- NEVER request unnecessary permissions
- Keep content scripts minimal — offload logic to background/service worker
- Test across Chrome and Firefox

## Security

- NEVER store secrets in code — use environment variables
- Sanitise all user-facing HTML with DOMPurify
- NEVER trust external page content — treat as untrusted input

## General

- Write clear, descriptive commit messages
- NEVER commit commented-out code or debug `console.log` statements
- NEVER commit credentials, API keys, or secrets
- No `.env` files in version control
