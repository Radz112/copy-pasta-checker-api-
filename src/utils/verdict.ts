interface VerdictTier {
  minScore: number;
  verdict: string;
  roasts: string[];
}

/** Tiers ordered high-to-low. First match where score >= minScore wins. */
const VERDICT_TIERS: VerdictTier[] = [
  {
    minScore: 95,
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

function getTier(score: number): VerdictTier {
  return VERDICT_TIERS.find(t => score >= t.minScore)!;
}

export function generateVerdict(score: number): string {
  return getTier(score).verdict;
}

export function generateRoast(score: number): string {
  const roasts = getTier(score).roasts;
  return roasts[Math.floor(Math.random() * roasts.length)];
}

export const NO_CODE_VERDICT = "No Code Found ❌";
export const NO_CODE_ROAST = "This address is emptier than the dev's promises.";
