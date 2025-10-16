<!-- 64d947f2-889a-452f-9e47-6a80ddecf41e 2ea70f3c-a421-493d-9d89-ca88fa420440 -->
# Agentic Commerce Interface - Full Implementation Plan

## Architecture Overview

Build a B2B SaaS platform that enables businesses to:

1. List products in AI-readable formats
2. Track product visibility across AI agents (ChatGPT, Perplexity, Claude, Gemini)
3. Optimize for AI discoverability (GEO)
4. Access analytics on product performance in AI contexts

**Tech Stack (Leveraging Current):**

- Frontend: Next.js 15 + React 19 + Tailwind + shadcn/ui
- Backend: Next.js API routes + Server Actions
- Database: PostgreSQL + Drizzle ORM
- Auth: Better Auth (already configured)
- Payments: Autumn.js/Stripe (already integrated)
- AI: Vercel AI SDK (OpenAI, Anthropic, Google, Perplexity)
- Additional: Redis (rate limiting, caching), Kafka/Queue (event tracking)

---

## Phase 1: Core Database Schema

**File:** `lib/db/commerce-schema.ts`

New tables:

```typescript
// Business accounts
businesses: {
  id, userId, businessName, domain, industry, 
  verifiedDomain, logoUrl, metadata, plan, 
  createdAt, updatedAt
}

// Product catalogs
productCatalogs: {
  id, businessId, name, description, 
  sourceType (shopify/woocommerce/csv/api), 
  sourceConfig, syncEnabled, lastSyncAt, 
  status, createdAt, updatedAt
}

// Products
products: {
  id, catalogId, businessId, sku, name, 
  description, price, currency, availability, 
  category, tags, imageUrl, metadata, 
  aiOptimizedDescription, schemaData (JSON-LD), 
  geoScore, isActive, createdAt, updatedAt
}

// Product feeds (AI-readable endpoints)
productFeeds: {
  id, businessId, feedUrl, format (json-ld/rss), 
  isPublic, apiKey, accessCount, 
  createdAt, updatedAt
}

// AI Agent tracking
agentQueries: {
  id, businessId, productId, agentType, 
  queryText, timestamp, ipAddress, 
  userAgent, metadata
}

// Product impressions/mentions
productImpressions: {
  id, businessId, productId, agentType, 
  position, context, citationUrl, 
  impressionType (shown/clicked/converted), 
  timestamp, metadata
}

// Conversion tracking
productConversions: {
  id, businessId, productId, source, 
  conversionValue, metadata, timestamp
}

// GEO optimization history
geoOptimizations: {
  id, productId, originalDescription, 
  optimizedDescription, scoreImprovement, 
  createdAt
}
```

**Key indexes:** businessId, productId, sku, agentType, timestamp

---

## Phase 2: Business Onboarding System

### 2.1 Registration & Domain Verification

**Pages:**

- `app/onboard/business/page.tsx` - Business registration form
- `app/onboard/verify-domain/page.tsx` - Domain verification flow

**Components:**

- `components/onboarding/business-form.tsx` - Multi-step form (business details, domain, industry)
- `components/onboarding/domain-verification.tsx` - DNS/meta tag verification UI
- `components/onboarding/verification-instructions.tsx` - Step-by-step guide

**API Routes:**

- `app/api/business/register/route.ts` - Create business account
- `app/api/business/verify-domain/route.ts` - Verify domain ownership
- `app/api/business/check-verification/route.ts` - Poll verification status

**Verification Methods:**

1. DNS TXT record: `geomize-verify=<token>`
2. Meta tag: `<meta name="geomize-verify" content="<token>">`
3. HTML file: `/.well-known/geomize-verify.txt`

### 2.2 Product Catalog Connection

**Pages:**

- `app/dashboard/catalogs/page.tsx` - Manage product catalogs
- `app/dashboard/catalogs/new/page.tsx` - Add new catalog source

**Components:**

- `components/catalogs/catalog-connector.tsx` - Multi-source connection UI
- `components/catalogs/shopify-connect.tsx` - Shopify OAuth flow
- `components/catalogs/woocommerce-connect.tsx` - WooCommerce API setup
- `components/catalogs/csv-upload.tsx` - CSV/JSON upload & mapping
- `components/catalogs/api-connect.tsx` - Custom API configuration
- `components/catalogs/sync-status.tsx` - Real-time sync progress

**API Routes:**

- `app/api/catalogs/connect/route.ts` - Initialize catalog connection
- `app/api/catalogs/sync/route.ts` - Trigger manual sync
- `app/api/catalogs/webhooks/shopify/route.ts` - Shopify webhooks
- `app/api/catalogs/webhooks/woocommerce/route.ts` - WooCommerce webhooks

**Lib Files:**

- `lib/integrations/shopify.ts` - Shopify API client & sync logic
- `lib/integrations/woocommerce.ts` - WooCommerce REST API client
- `lib/integrations/csv-parser.ts` - CSV parsing & field mapping
- `lib/integrations/product-normalizer.ts` - Normalize products to standard schema

---

## Phase 3: AI-Readable Product Feeds

### 3.1 JSON-LD Feed Generation

**API Routes:**

- `app/api/feeds/[businessId]/products.json/route.ts` - Public JSON-LD feed
- `app/api/feeds/[businessId]/schema.json/route.ts` - Schema.org structured data
- `app/api/feeds/[businessId]/sitemap.xml/route.ts` - XML sitemap for AI crawlers

**Lib Files:**

- `lib/feeds/json-ld-generator.ts` - Convert products to Schema.org JSON-LD
- `lib/feeds/feed-builder.ts` - Build optimized feeds for AI consumption
- `lib/feeds/schema-validator.ts` - Validate Schema.org compliance

**JSON-LD Structure:**

```typescript
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://api.geomize.com/products/{sku}",
  "name": "Product Name",
  "sku": "SKU123",
  "description": "AI-optimized description",
  "offers": {
    "@type": "Offer",
    "price": "99.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://business.com/product/sku123"
  },
  "brand": {
    "@type": "Brand",
    "name": "Business Name"
  },
  "image": "https://cdn.business.com/image.jpg",
  "category": "Electronics",
  "aggregateRating": {...},
  "geoDiscoverability": {
    "score": 85,
    "optimizedFor": ["ChatGPT", "Perplexity", "Claude"]
  }
}
```

### 3.2 API Infrastructure for AI Agents

**API Routes:**

- `app/api/v1/discover/route.ts` - Agent discovery endpoint (list all businesses)
- `app/api/v1/products/search/route.ts` - Semantic product search
- `app/api/v1/products/[sku]/route.ts` - Get specific product
- `app/api/v1/businesses/[domain]/products/route.ts` - Get business products

**Features:**

- Rate limiting per agent
- API key authentication for private feeds
- CORS headers for agent access
- Response caching with Redis
- Tracking middleware (log every query)

**Lib Files:**

- `lib/api/agent-auth.ts` - Verify agent identity & API keys
- `lib/api/rate-limiter.ts` - Rate limiting logic
- `lib/api/semantic-search.ts` - Vector search for products (Pinecone/Qdrant)

---

## Phase 4: Tracking & Analytics Layer

### 4.1 Event Tracking System

**API Routes:**

- `app/api/track/query/route.ts` - Track AI agent query
- `app/api/track/impression/route.ts` - Track product shown in AI response
- `app/api/track/click/route.ts` - Track product link clicked
- `app/api/track/conversion/route.ts` - Track conversion (webhook from business)

**Lib Files:**

- `lib/tracking/event-logger.ts` - Log events to DB + queue
- `lib/tracking/event-processor.ts` - Process events asynchronously
- `lib/tracking/fingerprinting.ts` - Generate agent/session fingerprints
- `lib/tracking/attribution.ts` - Attribute conversions to AI interactions

**Event Queue:**

- Use PostgreSQL for simple events
- Consider Kafka/Redis Streams for high volume

### 4.2 Analytics Dashboard

**Pages:**

- `app/dashboard/analytics/page.tsx` - Main analytics overview
- `app/dashboard/analytics/products/page.tsx` - Per-product analytics
- `app/dashboard/analytics/agents/page.tsx` - Per-agent performance

**Components:**

- `components/analytics/visibility-score-card.tsx` - Overall visibility score
- `components/analytics/agent-performance-chart.tsx` - Breakdown by AI agent
- `components/analytics/product-rankings-table.tsx` - Top/bottom products
- `components/analytics/query-insights.tsx` - Common queries leading to products
- `components/analytics/conversion-funnel.tsx` - Query → Impression → Click → Conversion
- `components/analytics/time-series-chart.tsx` - Trends over time (Recharts)

**Metrics:**

- Total queries mentioning business/products
- Impression rate (% of queries where product shown)
- Click-through rate (CTR)
- Conversion rate
- Visibility score per SKU (0-100)
- Agent distribution (which AIs show your products most)
- Position tracking (where products appear in responses)

**API Routes:**

- `app/api/analytics/overview/route.ts` - Dashboard summary stats
- `app/api/analytics/products/[sku]/route.ts` - Product-specific analytics
- `app/api/analytics/agents/route.ts` - Agent comparison data
- `app/api/analytics/queries/route.ts` - Query insights

**Lib Files:**

- `lib/analytics/metrics-calculator.ts` - Calculate visibility scores & metrics
- `lib/analytics/aggregator.ts` - Aggregate time-series data
- `lib/analytics/insights-generator.ts` - Generate actionable insights

---

## Phase 5: GEO Optimization Engine

### 5.1 AI Description Optimizer

**Pages:**

- `app/dashboard/optimize/page.tsx` - GEO optimization center
- `app/dashboard/optimize/products/[sku]/page.tsx` - Optimize specific product

**Components:**

- `components/optimization/description-optimizer.tsx` - AI rewriter interface
- `components/optimization/before-after-comparison.tsx` - Show original vs optimized
- `components/optimization/score-preview.tsx` - Predicted score improvement
- `components/optimization/bulk-optimizer.tsx` - Optimize multiple products

**API Routes:**

- `app/api/optimize/description/route.ts` - Generate optimized description
- `app/api/optimize/score/route.ts` - Calculate GEO score
- `app/api/optimize/bulk/route.ts` - Batch optimization queue

**Lib Files:**

- `lib/optimization/geo-scorer.ts` - Score product for AI discoverability
- `lib/optimization/description-rewriter.ts` - Use GPT-4 to rewrite descriptions
- `lib/optimization/schema-enhancer.ts` - Add rich schema data
- `lib/optimization/entity-extractor.ts` - Extract entities for Knowledge Graph alignment

**GEO Scoring Criteria:**

1. Clarity & specificity
2. Entity richness (brands, specs, use cases)
3. Semantic relevance
4. Schema.org completeness
5. Keyword optimization for common queries

### 5.2 Schema Optimization

**Features:**

- Auto-generate Schema.org properties
- Add AggregateRating, Review, FAQs
- Enhance with additional types (VideoObject, HowTo, etc.)

---

## Phase 6: Agentic Protocol Integration

### 6.1 Agent Registry

**Public Endpoint:**

- `https://geomize.com/.well-known/agent-registry.json`

Lists all businesses participating in the network:

```json
{
  "version": "1.0",
  "businesses": [
    {
      "name": "Example Co",
      "domain": "example.com",
      "feedUrl": "https://api.geomize.com/feeds/example-co/products.json",
      "categories": ["Electronics", "Home"],
      "verified": true
    }
  ]
}
```

### 6.2 AI Marketplace Integrations

**Future Integrations:**

- OpenAI GPT Store (custom actions)
- Anthropic Claude API (tool calling)
- Google Gemini Extensions
- Perplexity API partnerships

**Lib Files:**

- `lib/protocols/openai-actions.ts` - OpenAI Actions manifest
- `lib/protocols/claude-tools.ts` - Claude MCP tools
- `lib/protocols/agent-discovery.ts` - Publish to agent registries

---

## Phase 7: UI/UX Polish & Features

### 7.1 Business Dashboard

**Pages:**

- `app/dashboard/page.tsx` - Main dashboard (stats overview)
- `app/dashboard/products/page.tsx` - Product management
- `app/dashboard/feeds/page.tsx` - Feed configuration
- `app/dashboard/settings/page.tsx` - Business settings

**Components:**

- `components/dashboard/stats-cards.tsx` - Key metrics cards
- `components/dashboard/recent-activity.tsx` - Real-time activity feed
- `components/dashboard/quick-actions.tsx` - Common actions
- `components/products/product-table.tsx` - Sortable/filterable product list
- `components/products/product-editor.tsx` - Edit product details
- `components/feeds/feed-settings.tsx` - Configure feed visibility & access

### 7.2 Public Product Pages

**Pages:**

- `app/p/[sku]/page.tsx` - Public product page (for AI crawlers)
- `app/business/[domain]/page.tsx` - Public business profile

**Features:**

- SEO-optimized HTML
- JSON-LD embedded in `<head>`
- AI crawler detection (serve optimized content)

---

## Phase 8: Pricing & Monetization

### 8.1 Pricing Tiers

**Plans:**

| Tier | Price | Features |

|------|-------|----------|

| Free | $0 | 10 products, 1 catalog, basic analytics |

| Starter | $49/mo | 100 products, 3 catalogs, full analytics |

| Professional | $149/mo | 500 products, unlimited catalogs, GEO optimization |

| Enterprise | $499/mo | Unlimited products, API access, priority support |

### 8.2 Credit System (Alternative)

- Pay-per-query model
- $0.01 per AI agent query tracked
- Volume discounts

**API Routes:**

- `app/api/billing/usage/route.ts` - Get current usage
- `app/api/billing/upgrade/route.ts` - Upgrade plan
- `app/api/billing/webhook/route.ts` - Stripe webhook handler

**Lib Files:**

- `lib/billing/usage-tracker.ts` - Track usage against limits
- `lib/billing/subscription-manager.ts` - Manage Autumn subscriptions

---

## Phase 9: Testing & Launch

### 9.1 End-to-End Testing

**Test Scenarios:**

1. Business onboarding → domain verification
2. Shopify catalog sync → products imported
3. Generate JSON-LD feed → validate Schema.org
4. Simulate AI agent query → track impression
5. Analytics dashboard → verify metrics
6. GEO optimization → score improvement

### 9.2 AI Agent Testing

**Test with Real AIs:**

- Feed products to ChatGPT via browsing
- Query Perplexity with product keywords
- Check if Claude mentions products
- Verify Gemini can discover products

### 9.3 Performance Optimization

- Database indexes on high-query tables
- Redis caching for feeds
- CDN for JSON-LD endpoints
- Rate limiting to prevent abuse

---

## File Structure Summary

```
app/
  onboard/business/page.tsx
  onboard/verify-domain/page.tsx
  dashboard/
    page.tsx (main dashboard)
    products/page.tsx
    catalogs/page.tsx
    catalogs/new/page.tsx
    analytics/page.tsx
    analytics/products/page.tsx
    analytics/agents/page.tsx
    optimize/page.tsx
    optimize/products/[sku]/page.tsx
    feeds/page.tsx
    settings/page.tsx
  p/[sku]/page.tsx (public product page)
  business/[domain]/page.tsx
  api/
    business/register/route.ts
    business/verify-domain/route.ts
    catalogs/connect/route.ts
    catalogs/sync/route.ts
    catalogs/webhooks/shopify/route.ts
    feeds/[businessId]/products.json/route.ts
    v1/discover/route.ts
    v1/products/search/route.ts
    track/query/route.ts
    track/impression/route.ts
    analytics/overview/route.ts
    optimize/description/route.ts
    billing/usage/route.ts

components/
  onboarding/
    business-form.tsx
    domain-verification.tsx
  catalogs/
    catalog-connector.tsx
    shopify-connect.tsx
    csv-upload.tsx
    sync-status.tsx
  analytics/
    visibility-score-card.tsx
    agent-performance-chart.tsx
    product-rankings-table.tsx
    query-insights.tsx
    conversion-funnel.tsx
  optimization/
    description-optimizer.tsx
    before-after-comparison.tsx
    score-preview.tsx
  dashboard/
    stats-cards.tsx
    recent-activity.tsx
  products/
    product-table.tsx
    product-editor.tsx
  feeds/
    feed-settings.tsx

lib/
  db/
    commerce-schema.ts (NEW - all commerce tables)
  integrations/
    shopify.ts
    woocommerce.ts
    csv-parser.ts
    product-normalizer.ts
  feeds/
    json-ld-generator.ts
    feed-builder.ts
    schema-validator.ts
  api/
    agent-auth.ts
    rate-limiter.ts
    semantic-search.ts
  tracking/
    event-logger.ts
    event-processor.ts
    attribution.ts
  analytics/
    metrics-calculator.ts
    aggregator.ts
    insights-generator.ts
  optimization/
    geo-scorer.ts
    description-rewriter.ts
    schema-enhancer.ts
    entity-extractor.ts
  protocols/
    openai-actions.ts
    claude-tools.ts
    agent-discovery.ts
  billing/
    usage-tracker.ts
    subscription-manager.ts
```

---

## Environment Variables Needed

```env
# Existing
DATABASE_URL=
BETTER_AUTH_SECRET=
NEXT_PUBLIC_APP_URL=

# New Commerce
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
WOOCOMMERCE_CONSUMER_KEY=
WOOCOMMERCE_CONSUMER_SECRET=

# AI Optimization
OPENAI_API_KEY= (existing)
ANTHROPIC_API_KEY= (existing)

# Vector Search (optional)
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# Redis (caching/queue)
REDIS_URL=

# Stripe (existing via Autumn)
AUTUMN_SECRET_KEY=
```

---

## Success Metrics

**Launch Goals (3 months):**

- 50 businesses onboarded
- 10,000+ products indexed
- 100,000+ AI agent queries tracked
- 5 paying customers

**Growth Goals (6 months):**

- 500 businesses
- 100,000+ products
- 1M+ AI agent queries/month
- 50 paying customers
- Strategic partnership with 1 major AI platform

---

## Critical Path

1. **Week 1-2:** Database schema + business onboarding
2. **Week 3-4:** Product catalog sync (Shopify, CSV)
3. **Week 5-6:** JSON-LD feeds + public API
4. **Week 7-8:** Tracking system + event logging
5. **Week 9-10:** Analytics dashboard
6. **Week 11-12:** GEO optimization engine
7. **Week 13-14:** Testing + polish
8. **Week 15:** Launch + marketing

Total: ~4 months full-time work

### To-dos

- [ ] Create commerce database schema with businesses, products, catalogs, feeds, tracking tables
- [ ] Build business registration and domain verification system
- [ ] Implement product catalog sync (Shopify, WooCommerce, CSV upload)
- [ ] Build AI-readable JSON-LD feed generation and public API endpoints
- [ ] Implement event tracking for AI agent queries, impressions, conversions
- [ ] Build analytics dashboard with visibility scores, agent performance, conversion funnels
- [ ] Create GEO optimization engine with AI description rewriter and scoring
- [ ] Implement agentic protocol integrations (OpenAI Actions, Claude MCP, agent registry)
- [ ] Set up pricing tiers, usage tracking, and Stripe integration via Autumn
- [ ] Comprehensive testing with real AI agents and launch preparation