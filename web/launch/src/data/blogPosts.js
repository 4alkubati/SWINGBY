// F075 fix (2026-08-11): both the launch-announcement post and a whole
// dedicated post ('founder-pricing-explained', pulled below) advertised
// "first 100 businesses pay 5% instead of 10%" plus a free-for-a-year
// "Verified badge" and a free "featured listing" month. None of these exist:
// `PLATFORM_RATE = Decimal("0.10")` is hardcoded with no per-business
// override anywhere in escrow.py or payments_stripe.py, and no verified-badge
// or featured-listing product exists in any backend table or route
// (`grep -rn "featured\|verified.*badge" backend/app/api backend/app/models`
// returns nothing). Per CLAUDE.md: "Never change a rate to match marketing
// text" — the fee stays 10% and the copy is what moves. The same false claim
// also appears in Pricing.jsx, Signup.jsx and ForBusinesses.jsx (not fixed
// here — flagged separately, out of this finding's scope).
export const BLOG_POSTS = [
  {
    slug: 'swingby-launches-in-calgary',
    title: 'SwingBy launches in Calgary: A new way to find local services',
    excerpt: 'SwingBy is officially live in Calgary. Here\'s what you need to know about the platform and how it works.',
    category: 'Announcements',
    author: { name: 'Amr Basem', role: 'Founder' },
    publishedAt: '2026-06-01',
    readTime: 5,
    featured: true,
    content: `## SwingBy launches in Calgary\n\nWe're live. After months of building, testing, and talking to Calgary homeowners and service businesses, SwingBy is ready.\n\nThe problem we set out to solve is familiar: finding a reliable, fairly-priced local service provider is harder than it should be. You call around, wait for callbacks that never come, compare quotes on sticky notes, and hope for the best.\n\nWe built a better flow. Post a job, get competitive quotes from vetted businesses, pay safely through escrow. The whole loop in one place.\n\n### How escrow works\n\nYour payment is held safely, in full, when you accept a quote. None of it reaches the business until you approve the finished work — or 24 hours after they mark it done, if you go quiet. Open a dispute if needed — SwingBy support resolves within 72 hours.\n\n### For businesses\n\nFree to list. 10% transaction fee on completed bookings — lowest in the category, and nothing else to start.\n\n### What's next\n\nMobile apps (iOS and Android) are in development. More service categories coming based on demand.`,
  },
  {
    slug: 'why-escrow-for-home-services',
    title: 'Why escrow payments protect everyone — clients and businesses',
    excerpt: 'Understanding how escrow makes service bookings safer for both sides of the transaction.',
    category: 'Education',
    author: { name: 'Amr Basem', role: 'Founder' },
    publishedAt: '2026-05-20',
    readTime: 4,
    content: `## Why escrow protects everyone\n\nEscrow isn't new — it's used in real estate for the same reason we use it for services: trust through a neutral third party holding funds.\n\nFor clients: all of your money stays held until the job is done. You never wire the full amount to a stranger and hope they show up.\n\nFor businesses: the client is charged the moment they accept your quote, so you know the job is real and the money is there before you travel. No more chasing invoices or dealing with "I'll pay you when I have cash."\n\nAt SwingBy there is one release event: the client approves the finished work, or 24 hours pass after you mark it done. Then the whole amount releases, minus our 10% fee. Simple, fair, and automatic.`,
  },
]
