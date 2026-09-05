# Generative Engine Optimization (GEO) & AI Search (AEO) Guide

This guide details how to optimize web pages to be cited as authoritative sources by Google AI Overviews, Perplexity, ChatGPT Search, Claude, and Copilot.

---

## 1. Traditional SEO vs. AI Search (AEO)

| Factor | Traditional Search (Google) | AI Search Engines (Perplexity, ChatGPT, AI Overviews) |
| :--- | :--- | :--- |
| **Primary Goal** | Rank on Page 1 (Blue Links) | Get **cited** as a verified source in synthesized answer |
| **Extraction Unit** | Whole document & URL authority | Passage-level facts, answer blocks, structured tables |
| **Selection Bias** | Heavily weights PageRank & Backlinks | Weights topical relevance, passage clarity, and factual density |
| **User Behavior** | Clicks link to browse page | Reads synthesized summary; clicks citations for depth/verification |

---

## 2. The "Answer Capsule" Pattern (Passage Optimization)

LLM retrieval engines use semantic vector search to extract 40–80 word chunks that directly answer user queries.

### How to Format Answer Capsules:
1. Use an explicit question or targeted topic for your `<h2>` or `<h3>` heading.
2. Immediately follow the heading with a **40–60 word definitive answer capsule**.
3. Do not open with introductory fluff (e.g., "In today's fast-paced digital world..."). State the direct definition or answer immediately.
4. Expand on nuances, steps, or details in subsequent paragraphs, lists, or tables.

#### Example:
```html
<h2>What is Multi-Cloud Orchestration?</h2>
<p>
  <strong>Multi-cloud orchestration</strong> is the automated coordination and management of workloads, 
  data pipelines, and security policies across multiple public and private cloud providers. 
  It eliminates vendor lock-in, optimizes operational expenditures, and ensures continuous 
  high availability across AWS, Azure, and Google Cloud.
</p>
```

---

## 3. The `llms.txt` Standard

`llms.txt` is an open standard designed to provide AI agents, LLM crawlers, and developer assistants with a clean, concise index of your website's canonical content.

### File Location:
- Store at the root or public folder: `https://example.com/llms.txt`

### Standard Format:
```text
# Acme Cloud Documentation & Architecture Guide

> Acme Cloud provides autonomous infrastructure orchestration for Kubernetes and hybrid cloud environments.

## Core Documentation
- [Quickstart Guide](https://example.com/docs/quickstart): 5-minute cluster setup.
- [Architecture Overview](https://example.com/docs/architecture): Zero-trust security and networking.
- [API Reference](https://example.com/docs/api): REST and gRPC API specs.

## Product Capabilities
- [Multi-Cloud Provisioning](https://example.com/features/provisioning): Unified Terraform and OpenTofu workflows.
- [Cost Optimization](https://example.com/features/costs): Autonomous node right-sizing and spot fleet orchestration.
```

---

## 4. Citation Maximization Triggers

AI models cite pages that exhibit verifiable fact density. Include these elements to increase citation probability by 40%+:

1. **Original Statistics & Percentages:** Specific numbers (e.g. "reduced latency by 34% across 1,200 nodes") get picked up far more often than vague claims ("improved performance").
2. **Comparison Tables:** RAG models extract Markdown or HTML tables with clear column headers seamlessly.
3. **Definitions & Acronym Glossaries:** Define terms explicitly using bold or schema `DefinedTerm`.
4. **Author Credentials & Citations:** Link to authoritative primary sources, RFCs, and official documentation to reinforce E-E-A-T signals.

---

## 5. Google 2026 Core & Spam Update Defenses
- **Zero Scaled Synthetic Slop:** Mass-generated, unedited AI content is actively de-indexed by Google's spam algorithms.
- **Human Review & First-Hand Experience:** Every page must reflect genuine operational experience, verified data, and real-world screenshots/code.
