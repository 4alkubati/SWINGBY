export const HELP_CATEGORIES = [
  {
    key: 'getting-started',
    icon: 'RocketLaunch',
    titleKey: 'help.gettingStarted',
    description: 'Learn how to set up your account and post your first job.',
    count: 8,
  },
  {
    key: 'bookings',
    icon: 'CalendarCheck',
    titleKey: 'help.bookings',
    description: 'Manage your bookings, reschedule, or cancel appointments.',
    count: 12,
  },
  {
    key: 'payments',
    icon: 'CreditCard',
    titleKey: 'help.payments',
    description: 'Understand billing, refunds, and payment methods.',
    count: 10,
  },
  {
    key: 'account',
    icon: 'UserCircle',
    titleKey: 'help.account',
    description: 'Update your profile, change your password, or manage settings.',
    count: 7,
  },
  {
    key: 'safety',
    icon: 'ShieldCheck',
    titleKey: 'help.safety',
    description: 'Learn about our verification process and safety features.',
    count: 6,
  },
]

export const HELP_ARTICLES = [
  {
    slug: 'how-to-create-account',
    title: 'How to create a SwingBy account',
    category: 'getting-started',
    popular: true,
    content: `## How to create a SwingBy account

Creating a SwingBy account is quick and easy. Follow these steps to get started:

### Step 1: Visit the signup page
Go to [swingbyy.com/signup](/signup) or download the SwingBy app from the App Store or Google Play.

### Step 2: Choose your role
Select whether you want to **find services** (Client) or **offer services** (Business).

### Step 3: Enter your details
Fill in your email address, create a password, and add your display name.

### Step 4: Verify your email
Check your inbox for a confirmation email and click the verification link.

### Step 5: Complete your profile
Add your location, profile photo, and any other details to help us personalize your experience.

> **Tip:** Business accounts will need to complete additional verification before they can start receiving job requests.

---

Need help? [Contact our support team](/contact).`,
    relatedSlugs: ['how-to-post-first-job', 'account-verification', 'profile-setup-guide'],
  },
  {
    slug: 'how-to-post-first-job',
    title: 'How to post your first job',
    category: 'getting-started',
    popular: true,
    content: `## How to post your first job

Posting a job on SwingBy takes less than 2 minutes. Here's how:

### 1. Tap "Post a Job"
From your dashboard, tap the **Post a Job** button.

### 2. Select a category
Choose the type of service you need (e.g., Cleaning, Plumbing, Electrical).

### 3. Describe your job
Write a clear description of what you need done. The more detail you provide, the more accurate your quotes will be.

### 4. Set your budget
Enter your budget range. This helps businesses decide if the job is right for them.

### 5. Choose a date
Pick your preferred date and time for the service.

### 6. Submit and wait for quotes
Once submitted, verified local businesses will start sending you quotes. You'll be notified as they come in.

---

**What happens next?** Compare quotes, check reviews, and book the best pro for the job.`,
    relatedSlugs: ['how-to-create-account', 'understanding-quotes', 'how-to-book-service'],
  },
  {
    slug: 'understanding-quotes',
    title: 'Understanding quotes and pricing',
    category: 'bookings',
    popular: true,
    content: `## Understanding quotes and pricing

When you post a job on SwingBy, businesses send you quotes. Here's what you need to know:

### What's included in a quote?
Each quote includes:
- **Price** — the total cost for the service
- **Estimated duration** — how long the job will take
- **Business profile** — ratings, reviews, and verified badges
- **Message** — a note from the business about their approach

### How to compare quotes
We recommend comparing:
1. **Price vs. value** — the cheapest isn't always the best
2. **Reviews and ratings** — look at what previous clients say
3. **Response time** — faster responses often indicate reliability
4. **Verified status** — verified businesses have passed our checks

### Can I negotiate?
You can message businesses directly to discuss scope or pricing before booking.

---

*Quotes are valid for 48 hours unless the business specifies otherwise.*`,
    relatedSlugs: ['how-to-post-first-job', 'how-to-book-service', 'payment-methods'],
  },
  {
    slug: 'how-to-book-service',
    title: 'How to book a service',
    category: 'bookings',
    popular: true,
    content: `## How to book a service

Once you've received quotes, booking is simple:

### 1. Review your quotes
Compare price, ratings, and reviews from the businesses that quoted your job.

### 2. Select a quote
Tap on the quote you'd like to accept.

### 3. Confirm the details
Review the date, time, price, and scope of work. Make sure everything looks correct.

### 4. Add payment
If you haven't already, add a payment method to your account.

### 5. Confirm booking
Tap **Book Now** to confirm. The business will be notified immediately.

### After booking
- You'll receive a confirmation email
- You can message the business directly
- 50% of the payment is held in escrow
- The remaining 50% is charged on job completion

---

Need to reschedule? You can do so up to 24 hours before the appointment.`,
    relatedSlugs: ['understanding-quotes', 'cancellation-policy', 'payment-methods'],
  },
  {
    slug: 'payment-methods',
    title: 'Adding and managing payment methods',
    category: 'payments',
    popular: true,
    content: `## Adding and managing payment methods

SwingBy supports multiple payment methods for your convenience.

### Supported methods
- **Credit/debit cards** — Visa, Mastercard, American Express
- **Apple Pay** — available on iOS devices
- **Google Pay** — available on Android devices

### Adding a payment method
1. Go to **Settings > Payment Methods**
2. Tap **Add Payment Method**
3. Enter your card details or select a digital wallet
4. Tap **Save**

### Managing methods
- **Set a default** — tap the three dots next to a method and select "Set as Default"
- **Remove a method** — tap the three dots and select "Remove"

### Security
All payment information is encrypted and processed through Stripe. SwingBy never stores your full card number.

---

*Payment methods can also be managed from the SwingBy mobile app.*`,
    relatedSlugs: ['understanding-quotes', 'refund-policy', 'cancellation-policy'],
  },
  {
    slug: 'cancellation-policy',
    title: 'Cancellation and refund policy',
    category: 'payments',
    popular: true,
    content: `## Cancellation and refund policy

We understand plans change. Here's how cancellations work on SwingBy:

### Client cancellations
| Timing | Refund |
|--------|--------|
| 24+ hours before | Full refund |
| 12-24 hours before | 75% refund |
| Less than 12 hours | 50% refund |
| No-show | No refund |

### Business cancellations
Businesses that cancel confirmed bookings may receive a warning or account review.

### How to cancel
1. Go to **Bookings**
2. Select the booking you want to cancel
3. Tap **Cancel Booking**
4. Confirm the cancellation

Refunds are processed within 3-5 business days to your original payment method.

### Disputes
If you have an issue with a completed job, you can open a dispute within 48 hours of job completion.

---

*For urgent issues, [contact support](/contact).*`,
    relatedSlugs: ['payment-methods', 'how-to-book-service', 'refund-policy'],
  },
  {
    slug: 'account-verification',
    title: 'Account verification for businesses',
    category: 'account',
    popular: false,
    content: `## Account verification for businesses

To ensure quality and safety on SwingBy, all businesses go through a verification process.

### What we verify
- **Identity** — government-issued ID check
- **Business license** — proof of active business registration
- **Insurance** — proof of liability insurance (where applicable)
- **Background check** — criminal background screening

### How long does it take?
Most verifications are completed within **24-48 hours**. Complex cases may take up to 5 business days.

### Verified badge
Once verified, your profile will display a **verified badge**, which increases trust and booking rates.

### Maintaining verification
- Verifications are renewed annually
- You'll be notified before renewal is needed
- Keeping your documents up to date ensures uninterrupted service

---

*Questions about verification? [Contact us](/contact).*`,
    relatedSlugs: ['how-to-create-account', 'profile-setup-guide', 'safety-features'],
  },
  {
    slug: 'profile-setup-guide',
    title: 'Setting up your profile',
    category: 'account',
    popular: false,
    content: `## Setting up your profile

A complete profile helps you get more bookings (for businesses) or better service (for clients).

### For clients
- **Profile photo** — helps businesses know who to expect
- **Location** — we'll show services in your area
- **Phone number** — for booking confirmations and updates

### For businesses
- **Business name** — your official business name
- **Description** — tell clients what makes you great
- **Services** — list all services you offer with pricing
- **Portfolio** — upload photos of your previous work
- **Hours** — set your availability

### Tips for a great profile
1. Use a high-quality profile photo
2. Write a detailed but concise description
3. Keep your availability up to date
4. Respond to reviews promptly

---

*Profiles with photos get 3x more engagement.*`,
    relatedSlugs: ['how-to-create-account', 'account-verification', 'safety-features'],
  },
  {
    slug: 'safety-features',
    title: 'Safety features on SwingBy',
    category: 'safety',
    popular: false,
    content: `## Safety features on SwingBy

Your safety is our top priority. Here's what we do to keep you protected:

### For everyone
- **Verified profiles** — all businesses are verified before they can accept jobs
- **Secure payments** — all transactions are processed through encrypted channels
- **Reviews and ratings** — transparent feedback system

### For clients
- **In-app messaging** — communicate without sharing personal contact info
- **Real-time tracking** — know when your service provider is on the way
- **Emergency button** — quick access to emergency services
- **Job insurance** — up to $1,000 protection on every booked job

### For businesses
- **Client verification** — clients must verify their email and phone number
- **Payment guarantee** — funds are held in escrow before work begins
- **Dispute resolution** — fair process for resolving issues

### Reporting concerns
If you ever feel unsafe, you can report an issue directly from the app or [contact our safety team](/contact).

---

*We review all reports within 24 hours.*`,
    relatedSlugs: ['account-verification', 'cancellation-policy', 'profile-setup-guide'],
  },
  {
    slug: 'refund-policy',
    title: 'How refunds work',
    category: 'payments',
    popular: false,
    content: `## How refunds work

If you need a refund, here's what to expect.

### Automatic refunds
Refunds are processed automatically when:
- A business cancels a booking
- A booking is cancelled within the free cancellation window
- A dispute is resolved in the client's favor

### Manual refund requests
For other cases:
1. Go to **Bookings > Past Bookings**
2. Select the booking
3. Tap **Request Refund**
4. Describe the issue
5. Our team will review within 48 hours

### Refund timeline
- **Credit/debit cards**: 3-5 business days
- **Apple Pay / Google Pay**: 1-3 business days

### Partial refunds
In some cases, a partial refund may be issued based on the work completed and the nature of the dispute.

---

*All refund decisions are final but can be appealed once.*`,
    relatedSlugs: ['cancellation-policy', 'payment-methods', 'how-to-book-service'],
  },
]
