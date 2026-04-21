# CommandCenter

A fast, searchable developer cheat-sheet tool built with Next.js 16, React 19, and Tailwind v4.

## Features
- Command reference for CLI tools, frameworks, languages, and more
- Fuzzy search across tool names, commands, and scenarios (⌘K)
- Audience filtering (Engineer / Non-Engineer)
- Curated command view with "Show all" expansion
- Copy-to-clipboard and man-page links on every command
- Wise-inspired design system

## Stack
- Next.js 16 App Router with `force-static` pages
- Fuse.js for client-side fuzzy search
- Tailwind CSS v4 with `@theme inline` tokens
- Inter font with display swap

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The data is read from `../data/tools/*.json`. Run the generator to regenerate tool data:

```bash
python3 generator.py
```
