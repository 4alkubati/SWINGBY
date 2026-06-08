export const HELP_CATEGORIES = [
  { key: 'getting-started', title: 'Getting started', desc: 'Set up your account and post your first job.', count: 8 },
  { key: 'bookings', title: 'Bookings', desc: 'Manage, reschedule, or cancel appointments.', count: 12 },
  { key: 'payments', title: 'Payments', desc: 'Understand billing, refunds, and escrow.', count: 10 },
  { key: 'account', title: 'Account', desc: 'Update your profile and settings.', count: 7 },
  { key: 'safety', title: 'Safety', desc: 'Verification, disputes, and protection.', count: 6 },
]

export const HELP_ARTICLES = [
  {
    slug: 'how-to-create-account',
    title: 'How to create a SwingBy account',
    category: 'getting-started',
    popular: true,
    content: `## How to create a SwingBy account\n\nGo to /signup, choose your role (client or business), enter your email and password, and verify your email. Takes under two minutes.\n\n### Password requirements\nMinimum 8 characters, with uppercase, lowercase, and a digit.\n\n### Email verification\nCheck your inbox for a confirmation email and click the link. Without verification, some features may be limited.`,
  },
  {
    slug: 'how-to-post-a-job',
    title: 'How to post a job',
    category: 'getting-started',
    popular: true,
    content: `## How to post a job\n\nSign in, click "Post a job," describe what you need, set your budget, and choose your neighbourhood. Businesses in your area will be notified and can send quotes.\n\n### Tips for a good job post\n- Be specific about what you need\n- Include photos if possible\n- Set a realistic budget\n- Mention your preferred dates`,
  },
  {
    slug: 'how-escrow-works',
    title: 'How escrow payments work',
    category: 'payments',
    popular: true,
    content: `## How escrow payments work\n\nWhen you accept a quote and confirm a booking, your payment is held securely. 50% is released to the business on booking confirmation. The remaining 50% is released when you mark the job complete.\n\n### Disputes\nIf you're unhappy with the work, open a dispute before marking complete. SwingBy support will review and can hold funds until resolved.`,
  },
  {
    slug: 'business-verification',
    title: 'How business verification works',
    category: 'safety',
    popular: true,
    content: `## Business verification\n\nEvery business on SwingBy goes through a verification process:\n\n1. **Identity check** — confirm the business owner's identity\n2. **License check** — verify applicable trade licenses\n3. **Ongoing monitoring** — review flags and customer reports tracked continuously\n\nVerified businesses display a badge. Verified Business (paid tier) includes deeper license and insurance checks.`,
  },
]
