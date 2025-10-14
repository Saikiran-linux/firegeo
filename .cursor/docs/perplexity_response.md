# OpenAI Compatibility

> Use Perplexity’s Sonar API with OpenAI’s client libraries for seamless integration.

## OpenAI compatibility at a glance

Perplexity's Sonar API was designed with OpenAI compatibility in mind, matching the Chat Completions API interface. You can seamlessly use your existing OpenAI client libraries by simply changing the base URL and providing your Perplexity API key.

<Tip>
  Keep using your existing OpenAI SDKs to get started fast; switch to our [native SDKs](/guides/perplexity-sdk) later as needed.
</Tip>

## Configuring OpenAI SDKs to call Sonar

To start using Sonar with OpenAI's client libraries, pass your Perplexity API key and change the base\_url to `https://api.perplexity.ai`:

<Tabs>
  <Tab title="Python">
    ```python  theme={null}
    from openai import OpenAI

    client = OpenAI(
        api_key="YOUR_API_KEY",
        base_url="https://api.perplexity.ai"
    )

    resp = client.chat.completions.create(
        model="sonar-pro",
        messages=[
            {"role": "user", "content": "Hello!"}
        ]
    )
    print(resp.choices[0].message.content)
    ```
  </Tab>

  <Tab title="TypeScript">
    ```typescript  theme={null}
    import OpenAI from 'openai';

    const client = new OpenAI({
      apiKey: "YOUR_API_KEY",
      baseURL: "https://api.perplexity.ai"
    });

    const resp = await client.chat.completions.create({
      model: "sonar-pro",
      messages: [{ role: "user", content: "Hello!" }]
    });
    console.log(resp.choices[0].message.content);
    ```
  </Tab>
</Tabs>

<Check>
  Your responses will match OpenAI's format exactly. See the [response structure](#response-structure) section below for complete field details.
</Check>

## API compatibility

### Standard OpenAI parameters

These parameters work exactly the same as OpenAI's API:

* `model` - Model name (use Perplexity model names)
* `messages` - Chat messages array
* `temperature` - Sampling temperature (0-2)
* `max_tokens` - Maximum tokens in response
* `top_p` - Nucleus sampling parameter
* `frequency_penalty` - Frequency penalty (-2.0 to 2.0)
* `presence_penalty` - Presence penalty (-2.0 to 2.0)
* `stream` - Enable streaming responses

### Perplexity-specific parameters

These Perplexity-specific parameters are also included:

* `search_domain_filter` - Limit or exclude specific domains
* `search_recency_filter` - Filter by content recency
* `return_images` - Include image URLs in response
* `return_related_questions` - Include related questions
* `search_mode` - "web" (default) or "academic" mode selector.

<Info>See [API Reference](/api-reference) for parameter details and models.</Info>

## Examples with OpenAI's client libraries

### Basic Usage

Start with these simple examples to make your first API calls:

<Tabs>
  <Tab title="Python">
    ```python  theme={null}
    from openai import OpenAI

    client = OpenAI(
        api_key="YOUR_API_KEY",
        base_url="https://api.perplexity.ai"
    )

    response = client.chat.completions.create(
        model="sonar-pro",
        messages=[
            {"role": "user", "content": "What are the latest developments in AI?"}
        ]
    )

    print(response.choices[0].message.content)
    ```
  </Tab>

  <Tab title="TypeScript">
    ```typescript  theme={null}
    import OpenAI from 'openai';

    const client = new OpenAI({
        apiKey: "YOUR_API_KEY",
        baseURL: "https://api.perplexity.ai"
    });

    const response = await client.chat.completions.create({
        model: "sonar-pro",
        messages: [
            { role: "user", content: "What are the latest developments in AI?" }
        ]
    });

    console.log(response.choices[0].message.content);
    ```
  </Tab>
</Tabs>

### Advanced Examples

For more control over search behavior and response generation:

<Tabs>
  <Tab title="Python">
    <CodeGroup>
      ```python Search Filtering theme={null}
      from openai import OpenAI

      client = OpenAI(
          api_key="YOUR_API_KEY",
          base_url="https://api.perplexity.ai"
      )

      response = client.chat.completions.create(
          model="sonar-pro",
          messages=[
              {"role": "user", "content": "Latest climate research findings"}
          ],
          extra_body={
              "search_domain_filter": ["nature.com", "science.org"],
              "search_recency_filter": "month"
          }
      )

      print(response.choices[0].message.content)
      print(f"Sources: {len(response.search_results)} articles found")
      ```

      ```python Full Configuration theme={null}
      from openai import OpenAI

      client = OpenAI(
          api_key="YOUR_API_KEY",
          base_url="https://api.perplexity.ai"
      )

      response = client.chat.completions.create(
          model="sonar-pro",
          messages=[
              {"role": "system", "content": "Be precise and concise."},
              {"role": "user", "content": "How many stars are in our galaxy?"}
          ],
          temperature=0.2,
          max_tokens=1000,
          extra_body={
              "search_mode": "web",
              "search_domain_filter": ["nasa.gov", "space.com"],
              "return_related_questions": True
          }
      )

      print(response.choices[0].message.content)
      for result in response.search_results:
          print(f"- {result['title']}: {result['url']}")
      ```
    </CodeGroup>
  </Tab>

  <Tab title="TypeScript">
    <CodeGroup>
      ```typescript Search Filtering theme={null}
      import OpenAI from 'openai';

      const client = new OpenAI({
          apiKey: "YOUR_API_KEY",
          baseURL: "https://api.perplexity.ai"
      });

      const response = await client.chat.completions.create({
          model: "sonar-pro",
          messages: [
              { role: "user", content: "Latest climate research findings" }
          ],
          // TypeScript SDK: Use direct parameters (not extra_body)
          search_domain_filter: ["nature.com", "science.org"],
          search_recency_filter: "month"
      });

      console.log(response.choices[0].message.content);
      console.log(`Sources: ${response.search_results.length} articles found`);
      ```

      ```typescript Full Configuration theme={null}
      import OpenAI from 'openai';

      const client = new OpenAI({
          apiKey: "YOUR_API_KEY",
          baseURL: "https://api.perplexity.ai"
      });

      const response = await client.chat.completions.create({
          model: "sonar-pro",
          messages: [
              { role: "system", content: "Be precise and concise." },
              { role: "user", content: "How many stars are in our galaxy?" }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          search_mode: "web",
          search_domain_filter: ["nasa.gov", "space.com"],
          return_related_questions: true
      });

      console.log(response.choices[0].message.content);
      response.search_results.forEach(result => {
          console.log(`- ${result.title}: ${result.url}`);
      });
      ```
    </CodeGroup>
  </Tab>
</Tabs>

## Response structure

Perplexity API responses include both standard OpenAI fields and additional search metadata:

### Standard OpenAI Fields

* `choices[0].message.content` - The AI-generated response
* `model` - The model name used
* `usage` - Token consumption details
* `id`, `created`, `object` - Standard response metadata

### Perplexity-Specific Fields

* `search_results` - Array of web sources with titles, URLs, and dates
* `usage.search_context_size` - Search context setting used

<Tabs>
  <Tab title="Python">
    ```python  theme={null}
    # Access the main response
    content = response.choices[0].message.content
    print(content)

    # Access search sources
    for result in response.search_results:
        print(f"Source: {result['title']}")
        print(f"URL: {result['url']}")
        print(f"Date: {result['date']}")
        print("---")

    # Check token usage
    print(f"Tokens used: {response.usage.total_tokens}")
    ```
  </Tab>

  <Tab title="TypeScript">
    ```typescript  theme={null}
    // Access the main response
    const content = response.choices[0].message.content;
    console.log(content);

    // Access search sources
    response.search_results.forEach(result => {
        console.log(`Source: ${result.title}`);
        console.log(`URL: ${result.url}`);
        console.log(`Date: ${result.date}`);
        console.log("---");
    });

    // Check token usage
    console.log(`Tokens used: ${response.usage.total_tokens}`);
    ```
  </Tab>
</Tabs>

<Info>
  Search results are returned even when streaming is enabled, but they arrive in the final chunk of the stream. See the [Streaming Guide](/guides/streaming-responses) for details.
</Info>

## Unsupported and notable differences

While compatibility is high, note the following differences from OpenAI:

* **Model names**: Use Perplexity models like `sonar-pro`, `sonar-reasoning`.
* **Search controls**: Perplexity adds web/academic search parameters via `extra_body` (Python) or root fields (TypeScript) as shown above.

<Warning>
  If you previously used OpenAI-only fields that aren't applicable to Perplexity search controls, remove or ignore them. Check the API Reference for the current list of supported fields.
</Warning>

## Technical notes

* **Error format**: Same as OpenAI's API for compatibility
* **Rate limiting**: Apply standard rate limiting practices
* **Model names**: Use Perplexity model names (`sonar-pro`, `sonar-reasoning`, etc.)
* **Authentication**: Use `Bearer` token format in Authorization header

## Next steps

<CardGroup cols={2}>
  <Card title="Explore Models" icon="brain" href="/getting-started/models">
    Browse available Sonar models and their capabilities.
  </Card>

  <Card title="Search Controls" icon="magnifying-glass" href="/guides/search-control-guide">
    Learn to fine-tune search behavior with filters and parameters.
  </Card>

  <Card title="Streaming Guide" icon="play" href="/guides/streaming-responses">
    Implement real-time streaming responses in your application.
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference">
    View complete endpoint documentation and parameter details.
  </Card>
</CardGroup>
