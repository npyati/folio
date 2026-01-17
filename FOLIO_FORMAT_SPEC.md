# .folio File Format Specification

## Description
A simple text-based reading list format for the Folio browser extension.

## Format Rules
- One URL per line
- Blank lines are ignored
- Lines starting with '#' are comments (ignored)
- UTF-8 encoding
- File extension: `.folio`

## Example

```
# My Reading List - Technology Articles
https://example.com/article-1
https://example.com/article-2

# Science Section
https://science.example.com/research-paper
https://nature.com/latest-discovery

# Ignored line below (blank)

https://techcrunch.com/ai-article
```

## Use Cases
- Export current reading list for backup
- Share reading lists between devices
- Import curated reading lists from others
- Version control reading lists in git repositories

## Instructions for Claude

When a user asks you to create a reading list in .folio format:

1. Use the `.folio` file extension
2. Put one URL per line
3. Add helpful comment headers using `#` to organize topics/sections
4. Leave blank lines between sections for readability
5. Only include valid, complete URLs (starting with `http://` or `https://`)

## Example Request

> "Create a .folio reading list about AI safety with 5 articles"

Example response:

```folio
# AI Safety Reading List - 2026-01-14
# Curated collection of essential AI safety articles

# Foundational Concepts
https://example.com/ai-alignment-intro
https://example.com/ai-safety-basics

# Technical Approaches
https://example.com/interpretability-research
https://example.com/mesa-optimization

# Policy and Governance
https://example.com/ai-governance-frameworks
```

## Import/Export in Folio

**Export:** Open the settings panel (⚙️ icon) and click the "📋 Export .folio" button to download your current reading list as a `.folio` file.

**Import:** Drag and drop a `.folio` file onto the articles panel in the Folio extension. This will replace your existing collection with the imported reading list.
