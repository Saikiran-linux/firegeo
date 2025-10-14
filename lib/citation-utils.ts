import { Citation, AIResponse, CitationAnalysis, SourceFrequency, CitationsByCompany } from './types';

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Analyze citations from AI responses and build comprehensive citation analysis
 */
export function analyzeCitations(
  responses: AIResponse[],
  brandName: string,
  competitors: string[]
): CitationAnalysis {
  const allCitations: Citation[] = [];
  const sourceMap = new Map<string, SourceFrequency>();
  const brandCitations: Citation[] = [];
  const competitorCitationsMap = new Map<string, Citation[]>();

  // Initialize competitor maps
  competitors.forEach(comp => {
    competitorCitationsMap.set(comp, []);
  });

  // Process all responses and collect citations
  responses.forEach(response => {
    if (!response.citations || response.citations.length === 0) return;

    response.citations.forEach(citation => {
      allCitations.push(citation);
      
      const domain = extractDomain(citation.url);
      const mentionedCompanies = citation.mentionedCompanies || [];

      // Update source frequency map
      if (sourceMap.has(citation.url)) {
        const existing = sourceMap.get(citation.url)!;
        existing.frequency++;
        if (!existing.providers.includes(response.provider)) {
          existing.providers.push(response.provider);
        }
        // Merge mentioned companies
        mentionedCompanies.forEach(company => {
          if (!existing.mentionedCompanies.includes(company)) {
            existing.mentionedCompanies.push(company);
          }
        });
      } else {
        sourceMap.set(citation.url, {
          url: citation.url,
          domain,
          title: citation.title,
          frequency: 1,
          providers: [response.provider],
          mentionedCompanies: [...mentionedCompanies]
        });
      }

      // Categorize by mentioned companies
      if (mentionedCompanies.includes(brandName)) {
        brandCitations.push(citation);
      }

      competitors.forEach(comp => {
        if (mentionedCompanies.includes(comp)) {
          competitorCitationsMap.get(comp)!.push(citation);
        }
      });
    });
  });

  // Sort sources by frequency
  const topSources = Array.from(sourceMap.values())
    .sort((a, b) => b.frequency - a.frequency);

  // Get top domains for brand
  const brandDomainMap = new Map<string, number>();
  brandCitations.forEach(citation => {
    const domain = extractDomain(citation.url);
    brandDomainMap.set(domain, (brandDomainMap.get(domain) || 0) + 1);
  });
  const brandTopDomains = Array.from(brandDomainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);

  // Build competitor citations data
  const competitorCitations: Record<string, CitationsByCompany> = {};
  competitors.forEach(comp => {
    const citations = competitorCitationsMap.get(comp) || [];
    const domainMap = new Map<string, number>();
    
    citations.forEach(citation => {
      const domain = extractDomain(citation.url);
      domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
    });

    const topDomains = Array.from(domainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain]) => domain);

    competitorCitations[comp] = {
      totalCitations: citations.length,
      sources: citations,
      topDomains
    };
  });

  // Build provider breakdown
  const providerBreakdown: Record<string, SourceFrequency[]> = {};
  responses.forEach(response => {
    if (!response.citations || response.citations.length === 0) return;
    
    if (!providerBreakdown[response.provider]) {
      providerBreakdown[response.provider] = [];
    }

    response.citations.forEach(citation => {
      const domain = extractDomain(citation.url);
      const existing = providerBreakdown[response.provider].find(s => s.url === citation.url);
      
      if (existing) {
        existing.frequency++;
      } else {
        providerBreakdown[response.provider].push({
          url: citation.url,
          domain,
          title: citation.title,
          frequency: 1,
          providers: [response.provider],
          mentionedCompanies: citation.mentionedCompanies || []
        });
      }
    });
  });

  return {
    totalSources: sourceMap.size,
    topSources,
    brandCitations: {
      totalCitations: brandCitations.length,
      sources: brandCitations,
      topDomains: brandTopDomains
    },
    competitorCitations,
    providerBreakdown
  };
}

/**
 * Extract citations from provider-specific response formats
 */
export function extractCitationsFromResponse(
  provider: string,
  response: any,
  brandName: string,
  competitors: string[]
): Citation[] {
  const citations: Citation[] = [];

  console.log(`[extractCitations] Processing ${provider} response:`, {
    responseType: typeof response,
    hasResponse: !!response,
    responseKeys: response ? Object.keys(response).slice(0, 10) : [],
    hasToolResults: !!response?.toolResults,
    hasSteps: !!response?.steps,
    hasExperimentalProviderMetadata: !!response?.experimental_providerMetadata
  });

  try {
    // First, check for AI SDK's standardized tool results format
    if (response?.toolResults && Array.isArray(response.toolResults)) {
      console.log(`[extractCitations] Found ${response.toolResults.length} tool results from AI SDK`);
      response.toolResults.forEach((toolResult: any, index: number) => {
        console.log(`[extractCitations] Tool result ${index}:`, {
          toolName: toolResult.toolName,
          hasResult: !!toolResult.result,
          resultKeys: toolResult.result ? Object.keys(toolResult.result) : []
        });
        
        if (toolResult.toolName === 'web_search' || toolResult.toolName?.includes('search')) {
          const result = toolResult.result;
          
          // Check for various citation formats
          if (result?.citations && Array.isArray(result.citations)) {
            result.citations.forEach((citation: any) => {
              citations.push({
                url: citation.url || '',
                title: citation.title || citation.document_title || '',
                snippet: citation.cited_text || citation.snippet || '',
                source: citation.source || extractDomain(citation.url || ''),
                mentionedCompanies: detectMentionedCompanies(
                  citation.cited_text || citation.snippet || '',
                  brandName,
                  competitors
                )
              });
            });
          }
          
          // Check for search_results format
          if (result?.search_results && Array.isArray(result.search_results)) {
            result.search_results.forEach((searchResult: any, idx: number) => {
              citations.push({
                url: searchResult.url || '',
                title: searchResult.title || '',
                snippet: searchResult.snippet || searchResult.content || '',
                source: searchResult.source || extractDomain(searchResult.url || ''),
                position: idx,
                mentionedCompanies: []
              });
            });
          }
        }
      });
    }
    
    // Check for steps (multi-step tool use)
    if (response?.steps && Array.isArray(response.steps)) {
      console.log(`[extractCitations] Found ${response.steps.length} steps`);
      response.steps.forEach((step: any) => {
        if (step.toolResults && Array.isArray(step.toolResults)) {
          step.toolResults.forEach((toolResult: any) => {
            if (toolResult.toolName?.includes('search') && toolResult.result) {
              // Extract citations from tool result
              const result = toolResult.result;
              if (result.citations) {
                result.citations.forEach((citation: any) => {
                  citations.push({
                    url: citation.url || '',
                    title: citation.title || '',
                    snippet: citation.snippet || '',
                    source: extractDomain(citation.url || ''),
                    mentionedCompanies: detectMentionedCompanies(
                      citation.snippet || '',
                      brandName,
                      competitors
                    )
                  });
                });
              }
            }
          });
        }
      });
    }
    
    // Check experimental provider metadata
    if (response?.experimental_providerMetadata) {
      const metadata = response.experimental_providerMetadata;
      console.log(`[extractCitations] Found experimental provider metadata for ${provider}`);
      
      // Google grounding metadata
      if (metadata.google?.groundingMetadata?.groundingChunks) {
        metadata.google.groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
          if (chunk.web) {
            citations.push({
              url: chunk.web.uri || '',
              title: chunk.web.title || '',
              source: extractDomain(chunk.web.uri || ''),
              position: index,
              mentionedCompanies: []
            });
          }
        });
      }
      
      // Anthropic citations
      if (metadata.anthropic?.citations) {
        metadata.anthropic.citations.forEach((citation: any) => {
          citations.push({
            url: citation.url || '',
            title: citation.title || '',
            snippet: citation.cited_text || '',
            source: extractDomain(citation.url || ''),
            mentionedCompanies: detectMentionedCompanies(
              citation.cited_text || '',
              brandName,
              competitors
            )
          });
        });
      }
    }
    
    // If no citations found from AI SDK format, fall back to provider-specific formats
    if (citations.length === 0) {
      console.log(`[extractCitations] No citations from AI SDK format, checking provider-specific formats...`);
      switch (provider.toLowerCase()) {
      case 'anthropic':
        // Anthropic returns citations in text blocks
        if (response.content) {
          response.content.forEach((block: any) => {
            if (block.type === 'text' && block.citations) {
              block.citations.forEach((citation: any) => {
                citations.push({
                  url: citation.url || '',
                  title: citation.title || citation.document_title,
                  snippet: citation.cited_text,
                  mentionedCompanies: detectMentionedCompanies(
                    citation.cited_text || '',
                    brandName,
                    competitors
                  )
                });
              });
            }
          });
        }
        break;

      case 'google':
        // Google returns grounding metadata with chunks
        if (response.groundingMetadata?.groundingChunks) {
          response.groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
            if (chunk.web) {
              citations.push({
                url: chunk.web.uri || '',
                title: chunk.web.title,
                source: chunk.web.title,
                position: index,
                mentionedCompanies: [] // Will be populated from response text analysis
              });
            }
          });
        }
        break;

      case 'openai':
        // OpenAI returns annotations with url_citation
        if (response.choices?.[0]?.message?.content) {
          const content = response.choices[0].message.content;
          if (Array.isArray(content)) {
            content.forEach((item: any) => {
              if (item.type === 'output_text' && item.annotations) {
                item.annotations.forEach((annotation: any) => {
                  if (annotation.type === 'url_citation') {
                    citations.push({
                      url: annotation.url,
                      title: annotation.title,
                      snippet: content[0].text?.substring(
                        annotation.start_index,
                        annotation.end_index
                      ),
                      mentionedCompanies: detectMentionedCompanies(
                        content[0].text || '',
                        brandName,
                        competitors
                      )
                    });
                  }
                });
              }
            });
          }
        }
        break;

      case 'perplexity':
        // Perplexity returns search_results
        if (response.search_results) {
          response.search_results.forEach((result: any, index: number) => {
            citations.push({
              url: result.url,
              title: result.title,
              source: result.title,
              date: result.date,
              position: index,
              mentionedCompanies: [] // Will be populated from response text
            });
          });
        }
        break;
      }
    }
    
    console.log(`[extractCitations] ${provider} extracted ${citations.length} citations total`);
  } catch (error) {
    console.error(`[extractCitations] Error extracting citations from ${provider}:`, error);
  }

  return citations;
}

/**
 * Generate sample citations for testing/development
 * This is a temporary function to verify the UI works while we implement proper citation extraction
 */
export function generateSampleCitations(
  brandName: string,
  competitors: string[],
  provider: string
): Citation[] {
  const sampleSources = [
    { domain: 'techcrunch.com', title: 'Best SaaS Tools for 2024' },
    { domain: 'g2.com', title: 'Top Software Platforms Comparison' },
    { domain: 'capterra.com', title: 'User Reviews and Ratings' },
    { domain: 'producthunt.com', title: 'Featured Products This Month' },
    { domain: 'forbes.com', title: 'Enterprise Software Guide' },
    { domain: 'venturebeat.com', title: 'Startup Tools Overview' },
    { domain: 'medium.com', title: 'Developer Tools Review' },
    { domain: 'reddit.com', title: 'r/SaaS Discussion Thread' },
    { domain: 'stackoverflow.com', title: 'Community Recommendations' },
    { domain: 'hackernews.com', title: 'Tech News Discussion' }
  ];

  const citations: Citation[] = [];
  const numCitations = Math.floor(Math.random() * 3) + 2; // 2-4 citations

  for (let i = 0; i < numCitations && i < sampleSources.length; i++) {
    const source = sampleSources[i];
    const mentionedCompanies: string[] = [];
    
    // Randomly mention brand or competitors
    if (Math.random() > 0.3) {
      mentionedCompanies.push(brandName);
    }
    
    if (Math.random() > 0.5 && competitors.length > 0) {
      const randomComp = competitors[Math.floor(Math.random() * competitors.length)];
      mentionedCompanies.push(randomComp);
    }

    citations.push({
      url: `https://${source.domain}/article-${i + 1}`,
      title: source.title,
      source: source.domain,
      snippet: `This article discusses various software solutions including ${mentionedCompanies.join(', ')}...`,
      date: '2024-01-15',
      position: i,
      mentionedCompanies
    });
  }

  return citations;
}

/**
 * Detect which companies are mentioned in a text snippet
 */
function detectMentionedCompanies(
  text: string,
  brandName: string,
  competitors: string[]
): string[] {
  const mentioned: string[] = [];
  const lowerText = text.toLowerCase();

  // Check brand
  if (lowerText.includes(brandName.toLowerCase())) {
    mentioned.push(brandName);
  }

  // Check competitors
  competitors.forEach(comp => {
    if (lowerText.includes(comp.toLowerCase())) {
      mentioned.push(comp);
    }
  });

  return mentioned;
}

/**
 * Enhance response text with citation analysis
 * This analyzes the response text to determine which companies are mentioned
 * in the context of each citation
 */
export function enhanceCitationsWithMentions(
  citations: Citation[],
  responseText: string,
  brandName: string,
  competitors: string[]
): Citation[] {
  return citations.map(citation => {
    // For now, we analyze the entire response text
    // In a more sophisticated version, we could analyze the specific snippet
    const mentionedCompanies = detectMentionedCompanies(
      responseText,
      brandName,
      competitors
    );

    return {
      ...citation,
      mentionedCompanies
    };
  });
}

