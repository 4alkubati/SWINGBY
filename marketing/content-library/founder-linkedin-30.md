# LinkedIn — Founder Posts (30 posts, build-in-public voice)

> Voice: personal, honest, direct. No "thrilled to announce." No buzzwords.
> These are founder posts — first person, Amr's voice, not company page.
> Mix: behind the scenes, lessons learned, honest updates, industry POV.
> Length: 3–6 short paragraphs. White space matters on LinkedIn.

---

## Post 1 — Launch

I launched SwingBy in Calgary this week.

It's a local service marketplace — clients post jobs, vetted local businesses respond with quotes, and payment is handled through escrow so both sides are protected.

I built the full backend in Python (FastAPI + Supabase), the web app in React, and the database in PostgreSQL. Solo, over 8 months, in Calgary.

The problem it solves: finding a reliable local service is harder than it should be. I got burned by no-shows, murky pricing, and unprotected payments. I built the thing I needed.

If you're in Calgary and need local services — or run one — swingbyy.com.

---

## Post 2 — Why I built it solo

People ask: "Why didn't you find a co-founder first?"

Honest answer: I wanted to know if I could build it.

Not delegate the technical parts while I "do the vision thing." Actually build it — the database schema, the auth layer, the API endpoints, the RLS policies, the frontend.

Now I know I can. That changes what conversations I can have with future team members and investors. I'm not looking for someone to explain the product to. I'm looking for someone to build the next layer with.

---

## Post 3 — What I learned building a marketplace

Marketplaces are hard because you need both sides before either side is useful.

Here's how I approached the chicken-and-egg problem:

Start with supply. I recruited Calgary businesses directly — door knocks, DMs, trades shows. Got 40 vetted businesses before launch.

Then open to clients. With supply ready, the first client who posts a job gets quotes quickly. That's the magic moment.

You can't do it the other way. A marketplace with zero businesses is just a blank form.

---

## Post 4 — Tech stack post

Since a few people have asked — here's the SwingBy tech stack:

Backend: FastAPI (Python), PostgreSQL via Supabase, JWT auth, Pydantic validation
Frontend: React + Vite, react-query, react-hook-form, Recharts for analytics
Auth: Supabase Auth (email/password + magic link)
Payments: Escrow logic in backend (Stripe integration coming)
Hosting: Cloudflare Pages (frontend), Render (backend)

The whole thing is a monorepo. The API is documented at /docs. RLS policies are applied to all 10 tables.

Is it the fanciest stack? No. Is it fast, secure, and maintainable by one person? Yes.

---

## Post 5 — First real booking

We got our first real completed booking this week.

A Calgary client posted a handyman job. Three businesses quoted within 2 hours. Client picked one based on reviews and price. Job was confirmed, completed, and both sides left reviews.

The escrow released automatically. The business got paid. The client marked it done.

The whole thing worked exactly as designed. That feeling is hard to describe.

---

## Post 6 — On building in a city you live in

Building a marketplace in the city you live in is different.

When I hear about a job posted in Kensington, I know that street. When a business signs up from the Beltline, I might walk past their van on my morning run.

That proximity keeps me honest. I can't hide behind "users" and "metrics." These are my neighbours. I need this to work for them.

It also means I can do things that remote teams can't — show up, ask questions, iterate fast.

---

## Post 7 — What's actually hard about trust

The word "trust" gets thrown around a lot in marketplace pitches.

Here's what trust actually requires on SwingBy:

For clients: evidence that the business is real (verified), has done good work (reviews), and that their money is safe (escrow). Not a badge. Actual mechanisms.

For businesses: confidence that the client is serious (they paid into escrow), will show up, and won't dispute a legitimate job.

Building both sides of trust at the same time, from zero, is the actual hard problem.

---

## Post 8 — Revenue model transparency

I'm going to be transparent about SwingBy's business model because I think opacity here is a mistake.

We charge 10% of the job total, taken from the business's payout on completion. Nothing from the client. Nothing upfront.

For the first 100 businesses: 5% (Founder pricing, locked in for life).

Why 10%? It covers the platform costs and leaves room to grow without a subscription model that punishes small operators.

No hidden fees. No "premium placement" that buries small businesses. No ads. That's the deal.

---

## Post 9 — What I wish I'd done differently

Three things I'd change if I started over:

1. Build the mobile app first. Web is fine, but clients want to post jobs from their phones in 30 seconds, not sit at a laptop.

2. Start with one category. I launched with 10+. I should have launched with just house cleaning, gotten that perfect, then expanded. Fewer edge cases, clearer marketing.

3. Talk to 20 businesses before writing a line of code. I talked to 5. I built assumptions that turned out to be wrong.

None of these were fatal mistakes. But I'd make different ones next time.

---

## Post 10 — On competition

Someone asked: "Aren't you just going up against TaskRabbit and Thumbtack?"

Sort of. Here's the difference:

Those platforms are American, national, and optimized for volume. They don't understand Calgary's housing stock, labour market, or seasonal patterns. They treat every city the same.

SwingBy is built for Calgary, by someone who lives here, with local businesses that are vetted locally. We're not trying to win globally. We're trying to win one neighbourhood at a time.

If that works here, we'll do it in Edmonton, Winnipeg, Halifax.

---

## Post 11 — Database schema was the hardest decision

When you build a marketplace, the database schema is the product.

Get it wrong and every feature you add breaks something. Get it right and the whole thing flows.

I spent two weeks on the schema before writing any API code. Ten tables. Row-level security on all of them. Separate tables for businesses, employees, bookings, payments, interests (the bidding mechanism), and messages.

The hardest call: making `post_id` nullable on bookings so we can support both the "post and match" flow AND direct bookings from the geo-browse map.

Details like that are invisible to users. They're what the whole thing runs on.

---

## Post 12 — Marketing is harder than engineering

Hot take for solo technical founders: marketing is harder than engineering.

With engineering, there are right answers. Tests pass or they don't. APIs return 200 or they don't.

With marketing, you can do everything right and still not break through. And you can do almost nothing and word-of-mouth carries you.

I'm still figuring it out. What I know: show up consistently, be honest about what the product is and what it isn't, and don't pretend to be bigger than you are.

---

## Post 13 — The escrow mechanism

One of the design decisions I'm most proud of: the escrow split.

When a booking is confirmed: 50% released to the business immediately. This gives them operating capital and signals the client is serious.

When the job is completed: the remaining 50%, minus the 10% platform fee, released to the business.

If cancelled more than 48h before the job: full refund minus 25% penalty.
If cancelled within 48h: 50% penalty.

Every number is a policy decision with consequences for both sides. I've thought about each one.

---

## Post 14 — How I handled vetting

"Vetted" is a word that sounds solid and can mean nothing.

Here's what SwingBy vetting actually means for MVP:

- Business profile is reviewed before activation (not automated)
- License status field starts as "pending" and is manually verified
- ID and business registration documents required for certain categories
- First 3 bookings are monitored closely

It's manual. It doesn't scale infinitely. But it's honest — we're not claiming algorithmic magic. We're claiming human judgment at launch, with plans to automate as we grow.

---

## Post 15 — On pricing as a solo founder

My pricing is wrong. I don't know which direction.

10% feels right today. In 6 months, when I have real data on average job size and churn, I'll know if it should be 7% or 12%.

The Founder pricing (5%) was a real promise to early businesses — not a marketing gimmick. The people who trusted us early get rewarded.

I'd rather have a slightly wrong price and real feedback than a perfect price I invented alone.

---

## Post 16 — Building in public: the uncomfortable part

Building in public means sharing the wins. That's easy.

The uncomfortable part is sharing the weeks where nothing happened. Where you pushed code that worked but nobody used it. Where the metrics were flat and you couldn't tell if that was normal or a sign.

I'm trying to be honest about those weeks too. Not for sympathy — because that's what "building in public" actually means.

---

## Post 17 — On RLS policies

If you build on Supabase and you haven't locked down your Row Level Security policies — stop reading this and go do that.

SwingBy has 33 API routes and 10 database tables. Every table has RLS enabled. Every policy is explicit. Zero tables are open to anonymous access.

This took a full day to get right. It was worth every hour.

The rule I live by: the backend enforces business logic. RLS enforces data isolation. They are not the same thing.

---

## Post 18 — The phone number problem

One of the things I care about deeply: businesses and clients on SwingBy cannot exchange phone numbers until a booking is confirmed.

Why: once they have each other's numbers, they'll take the transaction off-platform. The business loses the protection of escrow reviews. The client loses the protection of the rating system and payment guarantees.

The "interest" system — where businesses express interest and clients accept — is a deliberate friction point that keeps transactions inside the platform.

Not everyone loves this. I think it's right.

---

## Post 19 — Advice for technical solo founders

If you're a technical solo founder thinking about building a marketplace:

1. Build the auth layer first. It touches everything.
2. Design for roles on day one. I have three (client, business_owner, employee). Adding roles later is painful.
3. Use Supabase. It's the best backend-as-a-service for someone who wants real PostgreSQL without managing infrastructure.
4. Write your RLS policies before your first API endpoint. Seriously.
5. The frontend is harder than you think if you haven't built one in a while. Budget more time.

---

## Post 20 — What I'm reading / thinking about

Right now I'm thinking a lot about cold start problems.

Every marketplace has one. The question is which side you start with and how you get to critical mass before running out of runway.

I started with supply (businesses) before opening to clients. The theory: a client who posts a job and gets zero quotes will never come back. A client who posts and gets three quotes in an hour becomes a habit.

Reading: "The Cold Start Problem" by Andrew Chen. Worth your time if you're building a marketplace.

---

## Post 21 — Team update

SwingBy is still one person.

I get asked regularly if I'm hiring or looking for a co-founder. The honest answer: not yet. I want to get to a clear point of traction before bringing anyone in, so I know what skills actually matter.

When I do hire: the first person will be marketing-and-growth-focused. I can build. I need help telling people the product exists.

If that sounds like you and you're in Calgary (or willing to be): I'm paying attention.

---

## Post 22 — Why Calgary

People ask: why start in Calgary and not Toronto or Vancouver?

Here's my answer:

Toronto and Vancouver are saturated with marketplaces. The cost to acquire a customer through ads is high. The noise is deafening.

Calgary is a city of 1.3M people with strong small business culture, high homeownership rates, and not enough competition. If I can get to dominant position in Calgary, I have a template that works in every mid-size Canadian city.

Small pond first. Then bigger ponds.

---

## Post 23 — On the mobile app

The mobile app is coming.

Right now SwingBy is web-first. It works fine on mobile web. But I know from user feedback that people want to post a job from their phone in 30 seconds, not tap around a web interface.

React Native + Expo is the plan. I've started the architecture. It'll be the same API, same Supabase backend — just a native shell around the core flows.

Target: beta in Q3.

---

## Post 24 — Pricing mistakes I almost made

Two pricing mistakes I avoided (mostly by luck):

1. Charging clients a booking fee. Every marketplace does this and it creates resentment. Take the fee from the business — they're the ones generating the revenue.

2. Monthly subscription for businesses. This would have killed early adoption. Small operators don't trust recurring fees for platforms they haven't seen work yet. Percentage-on-completion only.

I'm still worried about one thing: the 10% feels fair to me but I haven't verified it against what the businesses feel. That's a gap I'm actively closing.

---

## Post 25 — The hardest thing about building a two-sided marketplace

The hardest thing isn't the technical complexity.

It's that you have two completely different customers with completely different problems, and your marketing, your product, and your support all have to serve both simultaneously.

A client doesn't care about the escrow mechanism until it protects them. A business doesn't care about the ratings system until it rewards them. You have to build the whole thing before either side gets the full value.

That's why most marketplace attempts fail in the first 6 months. Not bad ideas — bad sequencing.

---

## Post 26 — On reviews and trust signals

The single most important feature for a new marketplace: verified reviews.

Not reviews that any account can leave. Not reviews that businesses can ask friends to write. Verified reviews from confirmed completed bookings only.

On SwingBy: you can only leave a review for a booking that happened through the platform, that has a completion status, that was paid through escrow. Both sides leave reviews. Both sides are accountable.

It's a small thing. It's everything.

---

## Post 27 — What's coming next

A rough roadmap for SwingBy in the next 6 months:

- Mobile app (iOS + Android beta)
- Stripe payment integration (replacing the current escrow stub)
- More Calgary neighbourhoods and categories
- Business analytics dashboard (partially built)
- Automated license verification for certain trades
- Start of Edmonton market research

Not committing to dates yet. Moving fast but not pretending I can predict the future.

---

## Post 28 — Failure modes I'm watching for

Every marketplace has characteristic failure modes. Here are the ones I watch for on SwingBy:

1. **Disintermediation**: businesses and clients exchange numbers and take future bookings off-platform. Prevention: the ratings system has real value.

2. **Quality decay**: bad businesses slip through vetting as volume increases. Prevention: monitoring first 3 bookings, fast off-boarding.

3. **Category imbalance**: too many businesses in cleaning, not enough in others. Prevention: category-specific supply targets.

4. **Premature expansion**: opening Edmonton before Calgary is working. Prevention: clear definition of "working" before I expand.

---

## Post 29 — Founder pricing close-out

Quick update: we're getting close to the 100-business Founder pricing limit on SwingBy.

After the first 100 businesses, the platform fee goes to 10% (still competitive). Founder businesses lock in 5% for life.

If you run a service business in Calgary and you've been on the fence — this is the week to get off it.

[swingbyy.com/signup — Business tab]

---

## Post 30 — Reflection: why this is worth building

I'm going to end month one with the honest version of why I built this.

Local service businesses are the backbone of every neighbourhood. The cleaner who shows up reliably. The handyman who knows the neighbourhood's housing stock. The dog walker who actually cares about your dog.

These people don't have marketing budgets. They don't have SEO agencies. They have word of mouth and a hope that someone will find them.

SwingBy exists to be their digital word of mouth. To be the trust layer that helps good people get found.

That's worth building. Calgary is where we start.
