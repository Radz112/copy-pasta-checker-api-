/**
 * Verdict thresholds and corresponding messages
 */
interface VerdictTier {
  minScore: number;
  maxScore: number;
  verdict: string;
  roasts: string[];
}

const VERDICT_TIERS: VerdictTier[] = [
  {
    minScore: 95,
    maxScore: 100,
    verdict: "Ctrl+C Masterclass 🍝",
    roasts: [
      "This dev didn't even change the variable names.",
      "Copy, paste, deploy, rug. Classic speedrun.",
      "The only original thing here is the marketing wallet address.",
      "Ctrl+C, Ctrl+V, Ctrl+Scam",
      "Innovation level: changing the token name",
      "Even the bugs are inherited.",
      "The audacity to not even try.",
      "This contract was 'inspired by' (stolen from) greatness.",
    ]
  },
  {
    minScore: 85,
    maxScore: 94.99,
    verdict: "He changed the name and nothing else. 📋",
    roasts: [
      "Find & Replace: the only tool this dev knows.",
      "The whitepaper probably says 'revolutionary technology'.",
      "Originality score: 404 Not Found",
      "This is what happens when you hire from Fiverr.",
      "The dev's favorite button? Ctrl+V",
      "Tokenomics: Copy. Utility: Paste. Effort: Zero.",
      "This fork has the same bugs as the original. Feature parity!",
    ]
  },
  {
    minScore: 70,
    maxScore: 84.99,
    verdict: "Some effort was made... barely. 😐",
    roasts: [
      "Like a pizza with only one topping. Technically different.",
      "The dev attended a Solidity tutorial once.",
      "Effort level: participation trophy",
      "They changed enough to feel good about themselves.",
      "This is what 'inspired by' looks like in court.",
      "At least they tried? Kind of? Maybe?",
    ]
  },
  {
    minScore: 50,
    maxScore: 69.99,
    verdict: "Frankenstein Code 🧟",
    roasts: [
      "It's alive! But should it be?",
      "Multiple contracts were harmed in the making of this token.",
      "The dev took pieces from everywhere. Like a magpie. Or a thief.",
      "This code has more parents than a soap opera character.",
      "Stitched together with hope and prayer.",
      "When you order originality from Wish.com",
    ]
  },
  {
    minScore: 0,
    maxScore: 49.99,
    verdict: "Custom Logic Detected ✨",
    roasts: [
      "Either a genius or about to get rekt. No in-between.",
      "Original code? In this economy? Suspicious.",
      "The dev actually wrote something. We're watching closely.",
      "Novel approach detected. Proceed with caution.",
      "This is either innovation or a very creative rug.",
      "Custom code: where bugs are handcrafted with love.",
      "The road less traveled... probably for a reason.",
    ]
  },
];

/**
 * Gets the verdict tier for a given similarity score
 */
function getVerdictTier(score: number): VerdictTier {
  for (const tier of VERDICT_TIERS) {
    if (score >= tier.minScore && score <= tier.maxScore) {
      return tier;
    }
  }
  // Fallback to lowest tier
  return VERDICT_TIERS[VERDICT_TIERS.length - 1];
}

/**
 * Generates the narrative verdict based on similarity score
 */
export function generateVerdict(similarityScore: number): string {
  const tier = getVerdictTier(similarityScore);
  return tier.verdict;
}

/**
 * Generates a random roast based on similarity score
 */
export function generateRoast(similarityScore: number): string {
  const tier = getVerdictTier(similarityScore);
  const randomIndex = Math.floor(Math.random() * tier.roasts.length);
  return tier.roasts[randomIndex];
}

/**
 * Special case verdicts for edge cases
 */
export const SPECIAL_VERDICTS = {
  PROXY_DETECTED: {
    verdict: "Proxy Detected 🔍",
    roast: "This is just a shell. The real code is hiding somewhere else.",
  },
  NO_CODE: {
    verdict: "No Code Found ❌",
    roast: "This address is emptier than the dev's promises.",
  },
  FETCH_ERROR: {
    verdict: "Analysis Failed ⚠️",
    roast: "Even our analyzer couldn't handle this one.",
  },
  SELF_MATCH: {
    verdict: "Self-Aware Contract 🤖",
    roast: "Congratulations, the contract matches itself. Revolutionary.",
  },
} as const;

/**
 * Gets emoji for similarity score (for quick visual indication)
 */
export function getScoreEmoji(score: number): string {
  if (score >= 95) return "🍝";
  if (score >= 85) return "📋";
  if (score >= 70) return "😐";
  if (score >= 50) return "🧟";
  return "✨";
}

/**
 * Generates a brief summary combining verdict and context
 */
export function generateSummary(
  similarityScore: number,
  matchName: string,
  matchCategory: string
): string {
  const emoji = getScoreEmoji(similarityScore);

  if (similarityScore >= 95) {
    return `${emoji} ${similarityScore.toFixed(1)}% match to ${matchName}. Basically identical.`;
  }
  if (similarityScore >= 85) {
    return `${emoji} ${similarityScore.toFixed(1)}% match to ${matchName}. Find & Replace detected.`;
  }
  if (similarityScore >= 70) {
    return `${emoji} ${similarityScore.toFixed(1)}% similar to ${matchName}. Modified copy.`;
  }
  if (similarityScore >= 50) {
    return `${emoji} ${similarityScore.toFixed(1)}% similar to ${matchName}. Hybrid code.`;
  }
  return `${emoji} ${similarityScore.toFixed(1)}% match. Relatively unique code.`;
}

export default {
  generateVerdict,
  generateRoast,
  getScoreEmoji,
  generateSummary,
  SPECIAL_VERDICTS,
};
