<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# how do you include sources in web search response in openai, claude, perplexity, google using ai-sdk

Each major AI provider integrates source citations into web search responses differently, and the **AI SDK** provides a unified way to access or forward those sources. Here’s how it works for **OpenAI**, **Claude**, **Perplexity**, and **Google**, all through or in conjunction with the AI SDK.

***

### OpenAI (Responses API)

OpenAI’s **Responses API** supports built-in web search with source inclusion.
You can request sources using the **web_search** tool and set the `include` field to `["web_search_call.action.sources"]` to ensure citations are returned in the API response.

Example (JavaScript via AI SDK or direct API):

```js
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  tools: [{
    type: "web_search",
    filters: {
      include: ["web_search_call.action.sources"]
    }
  }],
  input: "Summarize latest CDC diabetes data."
});
console.log(response.output_text);
```

This enables OpenAI models like **GPT‑4o** or **GPT‑5** to return inline links or footnoted citations grounded in search results.[^1][^2][^3]

***

### Claude (Anthropic Citations API)

Anthropic’s **Citations API** allows Claude to automatically include references when generating answers.
Developers can enable it by passing `"citations": {"enabled": true}` in the API request. The output includes source-linked annotations pointing to the precise document segments used.

Example configuration (AI SDK compatible):

```json
{
  "model": "claude-3-opus",
  "citations": { "enabled": true },
  "input": "Summarize recent US election polling data."
}
```

Claude uses this for **web search grounding** and **document-based question answering**, returning verified URLs or document fragments.[^4][^5][^6][^7]

***

### Perplexity

Perplexity automatically includes citations for all web results, whether accessed through its own API or via the **AI SDK provider**.
Using the AI SDK, enable `sendSources` to forward citations to the client:

```js
import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';

const result = streamText({
  model: perplexity('sonar-pro'),
  messages: [{ role: 'user', content: 'Explain quantum computing basics.' }],
});

return result.toUIMessageStreamResponse({ sendSources: true });
```

Each Perplexity result returns organic citations as `{ sourceType: 'url', title, url }` objects, and the SDK can render them inline or as lists.[^8][^9][^10]

***

### Google (Gemini and Vertex AI)

Google’s **Generative AI provider** in the AI SDK uses **Search Grounding**.
When enabled, `generateText()` or `streamText()` responses include both **sources** and **grounding metadata** showing which web results were used.

```js
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text, sources, providerMetadata } = await generateText({
  model: google('gemini-2.5-flash'),
  tools: { google_search: google.tools.googleSearch({}) },
  prompt: "Top tech news this week with citations."
});

console.log(sources);  // [{ id, title, url, providerMetadata }]
```

Each `source` entry includes a `url`, `title`, and `providerMetadata` with `groundingMetadata` that details how it influenced the model’s output.[^11][^12][^13][^14][^15]

***

### Summary Table

| Provider | Method | How to Include Sources | Output Format |
| :-- | :-- | :-- | :-- |
| **OpenAI** | `responses` API / AI SDK | Add `include: ["web_search_call.action.sources"]` | Inline or structured citations [^2] |
| **Claude** | Citations API | `"citations": {"enabled": true}` | Inline document/web citations [^4][^7] |
| **Perplexity** | AI SDK Perplexity Provider | `sendSources: true` in UI stream | Source list with urls/titles [^8][^10] |
| **Google** | AI SDK Google Provider | Enable Search Grounding or URL Context tool | `sources[]` + `groundingMetadata` [^13][^15] |


***

In the **AI SDK**, the `result.sources` property or stream event `part.type === 'source'` exposes all groundings from supported models (OpenAI, Claude, Google, Perplexity) in a unified, structured format. This standardization allows developers to easily render or store citations for any multimodal or web‑augmented query.[^16][^12][^11]
<span style="display:none">[^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36]</span>

<div align="center">⁂</div>

[^1]: https://openai.com/index/new-tools-for-building-agents/

[^2]: https://platform.openai.com/docs/guides/tools-web-search

[^3]: https://community.openai.com/t/new-tools-for-building-agents-responses-api-web-search-file-search-computer-use-and-agents-sdk/1140896

[^4]: https://www.anthropic.com/news/introducing-citations-api

[^5]: https://docs.claude.com/en/docs/build-with-claude/tool-use/web-search-tool

[^6]: https://www.reddit.com/r/ClaudeAI/comments/1jfthsl/claude_can_now_search_the_web_each_response/

[^7]: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic

[^8]: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot

[^9]: https://www.youtube.com/watch?v=LOe2FMuBpT8

[^10]: https://ai-sdk.dev/providers/ai-sdk-providers/perplexity

[^11]: https://ai-sdk.dev/docs/ai-sdk-core/generating-text

[^12]: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

[^13]: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai

[^14]: https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-your-search-api

[^15]: https://ai.google.dev/gemini-api/docs/google-search

[^16]: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text

[^17]: https://ai-sdk.dev/docs/agents/building-agents

[^18]: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces

[^19]: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object

[^20]: https://ai-sdk.dev/docs/introduction

[^21]: https://ai-sdk.dev/docs/reference/stream-helpers/google-generative-ai-stream

[^22]: https://ai-sdk.dev/docs/announcing-ai-sdk-5-beta

[^23]: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0

[^24]: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

[^25]: https://ai-sdk.dev/docs/ai-sdk-core/image-generation

[^26]: https://ai-sdk.dev/docs/getting-started/expo

[^27]: https://ai-sdk.dev/docs/foundations/prompts

[^28]: https://ai-sdk.dev/docs/getting-started/nodejs

[^29]: https://ai-sdk.dev/cookbook/node/web-search-agent

[^30]: https://ai-sdk.dev/providers/ai-sdk-providers/openai

[^31]: https://community.openai.com/t/web-search-citations-not-appearing-in-api-response/1144110

[^32]: https://www.reddit.com/r/homeassistant/comments/1kedx77/help_needed_with_new_openai_websearch/

[^33]: https://docs.perplexity.ai/guides/search-guide

[^34]: https://github.com/home-assistant/core/issues/141902

[^35]: https://docs.perplexity.ai/guides/perplexity-sdk

[^36]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview

