> **V2 upgrade:** [feature ledger, usage and validation](V2_RELEASE.md).

# DocuSense AI

Enterprise document intelligence (retrieval-augmented Q&A) that runs **entirely client-side** — no backend, no API keys, no database, no data leaving the browser tab.

**Live demo:** deployed via GitHub Pages and Vercel (see repository "About" / deployments).

## Problem and purpose

Most portfolio "PDF chatbot" projects are a thin wrapper around a hosted LLM API: paste a key, call an endpoint, done. That demonstrates almost nothing about retrieval quality, evaluation discipline, or handling failure. DocuSense AI instead implements the real pieces of an enterprise RAG system — parsing, chunking, embeddings, semantic search, access control, and grounded extractive answering — and runs the whole pipeline as WebAssembly in the visitor's browser, so it is honestly demoable with zero infrastructure and zero ongoing cost.

## Architecture

```
Upload (PDF/TXT/MD)
   -> Parse (PDF.js, page-tracked text extraction)
   -> Chunk (~120-word windows, 20-word overlap)
   -> Embed (Xenova/all-MiniLM-L6-v2, 384-dim, quantized ONNX via Transformers.js)
   -> Store (in-memory vector array, per session)
   -> Retrieve (cosine similarity, filtered by simulated role-based access control)
   -> Extract (Xenova/distilbert-base-cased-distilled-squad, extractive QA)
   -> Cite (answer + confidence score + exact source chunk + document name)
```

Everything left of "Cite" runs in-browser via [Transformers.js](https://github.com/xenova/transformers.js) (ONNX Runtime Web, WASM backend) and [PDF.js](https://mozilla.github.io/pdf.js/). There is no server component and no network call other than the one-time model weight download (cached by the browser after first load).

## Dataset

Three synthetic-but-realistic sample documents are bundled directly in the page so the system is testable without uploading anything:

- `Acme_Employee_Handbook.txt` — public
- `CloudSync_Pro_Product_Spec.txt` — public
- `Q3_2026_Board_Report.txt` — tagged `finance` (restricted)

Users can also drop in their own PDF/TXT/MD files, which are processed the same way and never uploaded anywhere.

## Model selection

- **Embeddings:** `Xenova/all-MiniLM-L6-v2` — a standard, well-benchmarked sentence embedding model, small enough (~23 MB quantized) to load reliably over WASM without requiring WebGPU.
- **Answer extraction:** `Xenova/distilbert-base-cased-distilled-squad` — a SQuAD-tuned extractive QA model. It returns an exact answer span plus a genuine confidence score, rather than free-form generation, which removes an entire class of hallucination risk at the cost of only being able to answer questions whose answer is literally present in the retrieved text. That tradeoff is disclosed in the UI, not hidden.

A full generative LLM (e.g. via WebLLM/WebGPU) was deliberately **not** used for the primary answer path: WebGPU support and VRAM availability vary enough across visitors' machines that it would break the "zero issues" bar for a public demo. It remains a documented future improvement (see below).

## Evaluation

The "Evaluation" section on the live page runs a fixed 6-question golden set against whatever documents are currently loaded and reports, live and un-cached:

- **Recall@1** and **Recall@5** (did the correct source document appear in the retrieved candidates, and at what rank)
- **Mean Reciprocal Rank**
- **Answer keyword match rate** against known expected answers
- **Real measured latency per question**, not an assumed number

This is a genuine reproducible test, not a claimed metric — reviewers can re-run it themselves in the browser.

## Error analysis / known failure modes

- Extractive QA cannot answer questions requiring synthesis across multiple chunks (e.g. "compare the notice period to the sync engine's latency target") — it will return its best single-chunk guess with a correspondingly low confidence score rather than a fabricated synthesis.
- Very short or ambiguous questions sometimes retrieve the wrong chunk when several documents discuss similar topics (e.g. "policy" appearing in both the handbook and the product spec).
- PDF parsing quality depends on the source PDF having a real text layer; scanned image-only PDFs are not OCR'd (this is a documented limitation, not a silent failure — no chunks will be produced).
- If model score for the best candidate is below 0.15, the UI explicitly says "I couldn't find a confident answer" instead of returning a low-quality guess.

## Deployment

Static single HTML file (`index.html`). No build step. No environment variables. No secrets.

- **GitHub Pages:** branch `main`, folder `/(root)`.
- **Vercel:** Framework preset `Other`, no build command, output directory `.`.

## Performance

Cold model load: ~55 MB combined (embedder + QA model), one-time, cached by the browser afterward via the standard Cache API that Transformers.js uses. Per-question latency after warm-up is typically well under a second on a modern laptop, and is displayed live next to every answer rather than benchmarked once and quoted statically.

## Cost

$0. No API calls, no compute billed per request, no database. The only cost is the visitor's own device doing the inference.

## Security

No credentials exist in this project — there is nothing to leak. Documents a visitor uploads are processed only in that tab's memory (JavaScript objects and IndexedDB model cache) and are discarded on page reload. The role-based access control is a client-side simulation of the retrieval-time permission enforcement pattern used in real enterprise RAG systems (filter the candidate set before search, not after).

## Tests

The evaluation harness described above functions as an integration test: it exercises parsing, chunking, embedding, retrieval, and extraction end-to-end and asserts against known expected answers and expected source documents.

## Future improvements

- Optional generative synthesis step via WebGPU (WebLLM) for browsers that support it, with automatic fallback to the current extractive mode — rather than requiring WebGPU.
- OCR support for scanned PDFs via a WASM Tesseract build.
- Cross-encoder reranking pass between retrieval and extraction for higher precision on ambiguous queries.
- Persisting the document/embedding store to IndexedDB so a session survives a page reload.

## Tech stack

`Transformers.js` (ONNX Runtime Web / WASM) · `PDF.js` · vanilla HTML/CSS/JS · zero backend, zero API keys, zero build tooling.

## Regression checks

Requires Node.js 18 or newer. Run `node --test tests/ask-question.test.cjs` to check recovery from retrieval failures, chat clearing during inference, and duplicate submissions. These checks stub model inference; they do not measure real model quality.

## V2 reliability upgrade

Uploads now index atomically: failed or removed documents never publish partial embeddings. Model downloads can retry after a failed attempt. Empty/scanned PDFs show an explicit error; parsed PDF resources are released after use. Uploads are limited to 10 MB per file and 500 chunks per document. Answers and retrieval sources include page numbers.

Run `node --test tests/*.test.cjs`. GitHub Actions runs the regression suite on pushes and pull requests. Inference and PDF parsing are stubbed in unit tests; those tests do not validate model quality, actual browser memory use, or production authorization. Roles remain a client-side demonstration, not a security boundary. OCR and cross-document synthesis are not implemented.
