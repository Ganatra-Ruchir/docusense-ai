# DocuSense AI — Research Workspace V2

Release date: 12 October 2026.

## User-facing features

1. Search document names in the library.
2. Scope questions to one visible document.
3. Inspect complete source passages in a dialog.
4. Copy passages with document/page citations.
5. Export the current conversation as Markdown.
6. Reuse recent questions without retyping.
7. Save questions and filter the question trail to saved items.
8. Create and remove research notes.
9. Capture the latest completed answer in the notebook.
10. Export the notebook as Markdown.
11. Choose a 15%, 30% or 50% minimum answer score.
12. Monitor ready documents, indexed passages and processing counts.
13. Focus the question composer with Alt+Q.
14. Keep model loading and inference off the UI thread with a dedicated worker, retry handling and bounded timeouts.

## Use and limits

Open index.html through an HTTP server (`python -m http.server 8000`). Models require an initial network download. Research tools keep document text and notes in the current tab only; export before closing. Role selection is a demonstration, not an authentication boundary. Confidence scores are not calibrated probabilities. Inference remains extractive and can be wrong or slow on low-power devices. No OCR or server synchronization is included.

## Interface and reliability

Responsive layouts, keyboard focus, lightweight CSS animation with a pause control, and operating-system reduced-motion support. Browser checks cover representative workflows, download events, reload persistence where applicable, JavaScript errors and mobile overflow. Passing these checks is not a guarantee of zero defects.

## Verification

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

DocuSense browser workflow tests stub model and PDF dependencies to test interaction deterministically; they do not measure AI answer quality. Run the built-in real-model evaluation separately.

The release was also exercised with the real MiniLM and DistilBERT models in Chromium: all three sample documents indexed, no page errors, and 5/6 built-in synthetic answers matched expected keywords. The Business-tier storage question remains a low-confidence model error; normal chat abstains at the default threshold. Per-question times in that run ranged from 727 to 1,346 ms. These are device-specific observations, not a broad speed or accuracy claim. Worker isolation follows the [Transformers.js worker pattern](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/tutorials/next.md).
