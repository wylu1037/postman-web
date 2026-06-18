# postman-web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js AK/SK HTTP request client with SM4 and RSA+SM4 request encryption support.

**Architecture:** Core protocol behavior lives in small TypeScript modules with tests. The Next.js page calls the same request builder used by tests, displays generated signing/encryption debug output, and sends the final request with `fetch`.

**Tech Stack:** Next.js, React, TypeScript, shadcn-style local components, react-hook-form, zod, Vitest, WebCrypto, pure TypeScript SM4-GCM.

---

## Tasks

- [x] Write protocol tests first.
- [ ] Implement canonical signing and encryption modules.
- [ ] Build Next.js page and local shadcn-style UI components.
- [ ] Run tests, lint, build, and preview.
