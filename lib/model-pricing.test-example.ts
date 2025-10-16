/**
 * Example Usage of Model Pricing and Cost Tracking
 * This file demonstrates how costs are calculated
 */

import { calculateCostBreakdown, formatCost, getModelPricing } from './model-pricing';

// Example 1: Calculate cost for a GPT-4o call
console.log('=== Example 1: GPT-4o Cost ===');
const gpt4oCost = calculateCostBreakdown('gpt-4o', 1000, 2000);
console.log('Model:', gpt4oCost.modelId);
console.log('Input tokens:', gpt4oCost.inputTokens, '→', formatCost(gpt4oCost.inputCost));
console.log('Output tokens:', gpt4oCost.outputTokens, '→', formatCost(gpt4oCost.outputCost));
console.log('Total cost:', formatCost(gpt4oCost.totalCost));
console.log('Pricing per 1M tokens:', gpt4oCost.pricing);

// Example 2: Compare costs across providers for same usage
console.log('\n=== Example 2: Cost Comparison (1K input, 2K output) ===');
const models = ['gpt-4o', 'claude-3-5-sonnet-latest', 'gemini-1.5-pro', 'sonar'];
models.forEach(model => {
  const cost = calculateCostBreakdown(model, 1000, 2000);
  console.log(`${model.padEnd(30)} ${formatCost(cost.totalCost)}`);
});

// Example 3: Typical brand analysis costs
console.log('\n=== Example 3: Estimated Brand Analysis Costs ===');
console.log('Assumptions: 4 prompts × 4 providers = 16 LLM calls');
console.log('Average: 500 input tokens, 1500 output tokens per call\n');

const analysisModels = [
  { provider: 'OpenAI', model: 'gpt-4o' },
  { provider: 'Anthropic', model: 'claude-3-5-sonnet-latest' },
  { provider: 'Google', model: 'gemini-1.5-pro' },
  { provider: 'Perplexity', model: 'sonar' },
];

let totalCost = 0;
analysisModels.forEach(({ provider, model }) => {
  const cost = calculateCostBreakdown(model, 500, 1500);
  const perAnalysis = cost.totalCost * 4; // 4 prompts
  totalCost += perAnalysis;
  console.log(`${provider.padEnd(15)} ${formatCost(cost.totalCost)}/call × 4 = ${formatCost(perAnalysis)}`);
});

console.log('\nTotal cost per analysis:', formatCost(totalCost));
console.log('Cost for 100 analyses:', formatCost(totalCost * 100));

// Example 4: Model pricing lookup
console.log('\n=== Example 4: Model Pricing Lookup ===');
const geminiPricing = getModelPricing('gemini-2.0-flash-exp');
console.log('Gemini 2.0 Flash:', geminiPricing);
console.log('Note: Free during preview period!');

