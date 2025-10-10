import { generateObject } from 'ai';
import { z } from 'zod';
import FirecrawlApp, {
  FirecrawlError,
  type ScrapeParams,
  type ScrapeResponse,
} from '@mendable/firecrawl-js';
import { Company } from './types';
import { getConfiguredProviders, getProviderModel } from './provider-config';

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const FALLBACK_TIMEOUT_MS = 45000;

type FirecrawlStrategy = {
  name: string;
  options: ScrapeParams;
};

interface ScrapePayload {
  markdown?: string;
  html?: string;
  metadata?: ScrapeResponse['metadata'];
}

export class ScrapeServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, ScrapeServiceError.prototype);
  }
}

function sanitizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function buildStrategies(cacheAge: number): FirecrawlStrategy[] {
  const baseOptions: ScrapeParams = {
    formats: ['markdown', 'html', 'rawHtml', 'links'],
    headers: {
      'User-Agent': DESKTOP_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    blockAds: true,
    removeBase64Images: true,
    storeInCache: true,
    maxAge: cacheAge,
  };

  return [
    {
      name: 'auto-proxy-desktop',
      options: {
        ...baseOptions,
        timeout: 45000,
        waitFor: 2500,
        proxy: 'auto',
      },
    },
    {
      name: 'stealth-render',
      options: {
        ...baseOptions,
        timeout: 55000,
        waitFor: 4000,
        proxy: 'stealth',
        actions: [
          { type: 'wait', milliseconds: 2000 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 1500 },
        ],
      },
    },
    {
      name: 'mobile-stealth',
      options: {
        ...baseOptions,
        timeout: 60000,
        waitFor: 5000,
        proxy: 'stealth',
        mobile: true,
        actions: [
          { type: 'wait', milliseconds: 2500 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 2500 },
        ],
      },
    },
  ];
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetadataFromHtml(html: string, url: string) {
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const descriptionMatch = html.match(
    /<meta\s+(?:name|property)=["']description["']\s+content=["']([^"']*)["']/i,
  );
  const ogImageMatch = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i,
  );
  const faviconMatch = html.match(
    /<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i,
  );

  const urlObj = new URL(url);
  const origin = urlObj.origin;

  const resolvedFavicon = faviconMatch?.[1]
    ? faviconMatch[1].startsWith('http')
      ? faviconMatch[1]
      : `${origin}${faviconMatch[1].startsWith('/') ? '' : '/'}${faviconMatch[1]}`
    : undefined;

  const resolvedOgImage = ogImageMatch?.[1]
    ? ogImageMatch[1].startsWith('http')
      ? ogImageMatch[1]
      : `${origin}${ogImageMatch[1].startsWith('/') ? '' : '/'}${ogImageMatch[1]}`
    : undefined;

  return {
    title: titleMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim(),
    ogImage: resolvedOgImage,
    favicon: resolvedFavicon,
  };
}

function buildFaviconUrl(url: string, metadata?: Record<string, any>): string | undefined {
  if (metadata?.favicon) {
    return metadata.favicon;
  }

  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace('www.', '');

  if (metadata?.favIcon) {
    return metadata.favIcon;
  }

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

async function runFirecrawlStrategy(
  url: string,
  strategy: FirecrawlStrategy,
): Promise<ScrapePayload> {
  try {
    const response = await firecrawl.scrapeUrl(url, strategy.options);
    if (!response.success) {
      throw new ScrapeServiceError(
        response.error || `Firecrawl scrape failed (${strategy.name})`,
        'firecrawl',
        response.metadata?.statusCode,
        response,
      );
    }

    return {
      markdown: response.markdown,
      html: response.html || response.rawHtml,
      metadata: response.metadata,
    };
  } catch (error) {
    if (error instanceof FirecrawlError) {
      throw new ScrapeServiceError(
        error.message,
        'firecrawl',
        error.statusCode,
        error.details,
      );
    }
    throw error;
  }
}

async function fallbackDirectFetch(url: string): Promise<ScrapePayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': DESKTOP_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ScrapeServiceError(
        `Fallback fetch failed with status ${response.status}`,
        'direct-fetch',
        response.status,
      );
    }

    const html = await response.text();
    const metadata = extractMetadataFromHtml(html, url);

    return {
      html,
      metadata,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ScrapeServiceError) {
    if (error.statusCode && [401, 402, 403, 404].includes(error.statusCode)) {
      return false;
    }
    return true;
  }

  if (error && typeof error === 'object') {
    const code = (error as any).code;
    const message = (error as any).message?.toLowerCase?.() ?? '';
    return (
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      message.includes('timeout') ||
      message.includes('network error')
    );
  }

  return false;
}

const CompanyInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  industry: z.string(),
  mainProducts: z.array(z.string()),
  competitors: z.array(z.string()).optional(),
});

export async function scrapeCompanyInfo(url: string, maxAge?: number): Promise<Company> {
  const normalizedUrl = sanitizeUrl(url);
  const cacheAge = maxAge ? Math.floor(maxAge / 1000) : 604800;

  const strategies = buildStrategies(cacheAge);
  let lastError: unknown;
  let payload: ScrapePayload | null = null;

  for (let attempt = 0; attempt < strategies.length; attempt++) {
    const strategy = strategies[attempt];
    try {
      payload = await runFirecrawlStrategy(normalizedUrl, strategy);
      if (payload.markdown || payload.html) {
        break;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `[scrapeCompanyInfo] Firecrawl strategy failed (${strategy.name}):`,
        error,
      );

      if (!isRetryableError(error) || attempt === strategies.length - 1) {
        break;
      }

      const backoff = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  if (!payload || (!payload.markdown && !payload.html)) {
    try {
      payload = await fallbackDirectFetch(normalizedUrl);
    } catch (fallbackError) {
      console.error('[scrapeCompanyInfo] All scraping attempts failed:', fallbackError);
      if (lastError) {
        console.error('[scrapeCompanyInfo] Last Firecrawl error:', lastError);
      }
      return buildFallbackCompany(normalizedUrl);
    }
  }

  const html = payload.markdown || payload.html || '';
  const metadata = payload.metadata;

  const configuredProviders = getConfiguredProviders();
  if (configuredProviders.length === 0) {
    throw new ScrapeServiceError(
      'No AI providers configured and enabled for content extraction',
      'ai-providers',
    );
  }

  const provider = configuredProviders[0];
  const preferredModelId = provider.models.find((m) => {
    const name = m.name.toLowerCase();
    return name.includes('mini') || name.includes('flash') || name.includes('fast');
  })?.id;
  const model = getProviderModel(provider.id, preferredModelId || provider.defaultModel);

  if (!model) {
    throw new ScrapeServiceError(`${provider.name} model not available`, 'ai-providers');
  }

  const { object } = await generateObject({
    model,
    schema: CompanyInfoSchema,
    prompt: buildExtractionPrompt(normalizedUrl, html),
  });

  const inferredMetadata = payload.html
    ? extractMetadataFromHtml(payload.html, normalizedUrl)
    : undefined;

  const faviconUrl = buildFaviconUrl(normalizedUrl, metadata) ?? inferredMetadata?.favicon;
  const ogImage = metadata?.ogImage || inferredMetadata?.ogImage;

  return {
    id: crypto.randomUUID(),
    url: normalizedUrl,
    name: object.name,
    description: object.description,
    industry: object.industry,
    logo: ogImage,
    favicon: faviconUrl,
    scraped: true,
    scrapedData: {
      title: object.name,
      description: object.description,
      keywords: object.keywords,
      mainContent: html,
      mainProducts: object.mainProducts,
      competitors: object.competitors,
      ogImage,
      favicon: faviconUrl,
    },
  };
}

function buildExtractionPrompt(url: string, content: string): string {
  const truncatedContent = content.length > 20000 ? content.slice(0, 20000) : content;
  const plainContent = stripHtml(truncatedContent).slice(0, 15000);

  return `Extract company information from this website content.

URL: ${url}
Content:
"""
${plainContent}
"""

Return the company name, concise description, relevant keywords, and PRIMARY industry category.

Industry detection rules:
- If the company makes coolers, drinkware, outdoor equipment, camping gear, categorize as "outdoor gear"
- If the company offers web scraping, crawling, data extraction, or HTML parsing tools/services, categorize as "web scraping"
- If the company primarily provides AI/ML models or services, categorize as "AI"
- If the company offers hosting, deployment, or cloud infrastructure, categorize as "deployment"
- If the company is an e-commerce platform or online store builder, categorize as "e-commerce platform"
- If the company sells physical products directly to consumers (clothing, accessories, etc.), categorize as "direct-to-consumer brand"
- If the company is in fashion/apparel/underwear/clothing, categorize as "apparel & fashion"
- If the company provides software tools or APIs, categorize as "developer tools"
- If the company is a marketplace or aggregator, categorize as "marketplace"
- For other B2B software, use "SaaS"
- For other consumer products, use "consumer goods"

IMPORTANT:
1. For mainProducts, list ACTUAL PRODUCTS (e.g., "coolers", "tumblers", "drinkware")
2. For competitors, extract FULL COMPANY NAMES (e.g., "RTIC", "IGLOO", "Coleman")
3. Focus on what the company MAKES/SELLS, not what goes IN their products.`;
}

function buildFallbackCompany(url: string): Company {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace('www.', '');
  const companyName = domain.split('.')[0];
  const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  return {
    id: crypto.randomUUID(),
    url,
    name: formattedName,
    description: `Information about ${formattedName}`,
    industry: 'technology',
    scraped: false,
  };
}