// Canonical category taxonomy — single source of truth for the whole app.
// `id` is always `label.toLowerCase()`; `label` is the exact string sent to
// and received from the backend (service_posts.category / businesses.category).
// Do not fork this list — CategoryScroll, PostJobScreen, and BusinessSetupScreen
// all import from here so browse filters and post/business categories stay in sync.
export const CATEGORIES = [
  { id: 'cleaning', label: 'Cleaning', icon: 'droplet' },
  { id: 'plumbing', label: 'Plumbing', icon: 'tool' },
  { id: 'electrical', label: 'Electrical', icon: 'zap' },
  { id: 'landscaping', label: 'Landscaping', icon: 'feather' },
  { id: 'painting', label: 'Painting', icon: 'edit-3' },
  { id: 'carpentry', label: 'Carpentry', icon: 'clipboard' },
  { id: 'moving', label: 'Moving', icon: 'truck' },
  { id: 'handyman', label: 'Handyman', icon: 'tool' },
];

// Label-only list for screens that just need the strings sent to the backend
// (e.g. category picker chips on PostJobScreen / BusinessSetupScreen).
export const CATEGORY_LABELS = CATEGORIES.map((cat) => cat.label);
