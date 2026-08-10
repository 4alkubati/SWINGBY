// T70 — i18n module (i18n-js + expo-localization)
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
// Cross-platform storage wrapper (works on web + native).
import * as SecureStore from './services/storage';
import { resolveLocale } from './i18n-locales';
import { applyDirection, syncDirectionOnBoot } from './services/rtl';

const LOCALE_KEY = 'swingby_locale';

const translations = {
  en: {
    // Auth
    'auth.signin': 'Sign In',
    'auth.signup': 'Create Account',
    'auth.logout': 'Sign Out',
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.login': 'Log in',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.loading': 'Loading…',
    'common.error': 'Something went wrong',
    'common.retry': 'Try again',
    'common.done': 'Done',
    'common.edit': 'Edit',
    'common.share': 'Share',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.comingSoon': 'Coming soon',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.languageTitle': 'Select Language',
    'settings.notifications': 'Notifications',
    'settings.account': 'Account',
    'settings.privacy': 'Privacy & Legal',
    'settings.support': 'Support',
    'settings.editProfile': 'Edit Profile',
    'settings.privacyPolicy': 'Privacy Policy',
    'settings.termsOfService': 'Terms of Service',
    'settings.exportData': 'Export my data',
    'settings.deleteAccount': 'Delete my account',
    'settings.helpFAQ': 'Help & FAQ',
    'settings.contactUs': 'Contact us',
    'settings.signOut': 'Sign Out',
    'settings.version': 'Version',

    // Profile
    'profile.title': 'Edit Profile',
    'profile.firstName': 'First name',
    'profile.lastName': 'Last name',
    'profile.email': 'Email',
    'profile.emailLocked': 'Email — contact support to change',
    'profile.phone': 'Phone',
    'profile.saveChanges': 'Save changes',
    'profile.updated': 'Profile updated',
    'profile.updateError': 'Could not save changes',
    'profile.photoComingSoon': 'Photo upload coming soon',

    // Onboarding
    'onboarding.skip': 'Skip',
    'onboarding.getStarted': 'Get started',
    'onboarding.slide1Title': 'Local pros, on demand',
    'onboarding.slide1Sub': 'Plumbing, cleaning, lawn, more — quoted by trusted local businesses.',
    'onboarding.slide2Title': 'You set the day, they bid for it',
    'onboarding.slide2Sub': 'Post once. Compare quotes. Pick the best.',
    'onboarding.slide3Title': 'Verified workers, every time',
    'onboarding.slide3Sub': 'Photo proof on job complete. Escrow protects your payment.',

    // Referral
    'referral.title': 'Share Swingbyy, get $10 credit',
    'referral.body': 'When your friend completes their first booking, you both get $10 off your next job.',
    'referral.shareText': 'Join me on Swingbyy! Code: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'Share my code',
    'referral.stats': '%{friends} friends joined • $%{earned} earned',

    // FAQ
    'faq.title': 'Help & FAQ',
    'faq.q1': 'How does Swingbyy work?',
    'faq.q2': 'How do quotes get accepted?',
    'faq.q3': 'When does payment happen?',
    'faq.q4': 'What if a job goes wrong?',
    'faq.q5': 'How do I become a business?',
    'faq.q6': 'How do I delete my account?',

    // Booking — confirm-date handshake (chat thread + booking details)
    'booking.proposedDatesHeading': 'Business proposed these times',
    'booking.proposedTimesHeading': 'Proposed times — tap one to accept',
    'booking.waitingOtherSide': 'Times sent — waiting for the other side to accept',
    'booking.proposeTimesHeading': 'Agree on a time',
    'booking.proposeTimes': 'Propose a time',
    'booking.addAnotherTime': 'Add another time',
    'booking.sendProposal': 'Send proposal',
    'booking.proposalSentToast': 'Times proposed',
    'booking.proposeErrorToast': 'Could not send proposed times',
    'booking.confirmedFor': 'Confirmed for %{date}',
    'booking.dateConfirmedToast': 'Date confirmed',
    'booking.confirmDateErrorToast': 'Could not confirm date',
    'booking.viewFullDetails': 'View full details',
    'booking.detailsAction': 'Details',

    // Job opportunity card / quote sheet — client-uploaded photos (business side)
    'jobCard.photosLabel': 'Photos (%{count})',
    'jobCard.photoAlt': 'Job photo %{index} of %{count}',
    'imageViewer.close': 'Close',

    // Post a job — category picker
    'postJob.categoryOther': 'Other / General',

    // Search — name-based business search
    'search.placeholder': 'Search businesses, categories…',
    'search.recent': 'RECENT',
    'search.idleTitle': 'Search local pros',
    'search.idleBody': 'Type a business name or category',
    'search.noMatchesTitle': 'No matches',
    'search.noMatchesBody': 'No results for "%{query}"',
    'search.clear': 'Clear search',
    'search.errorTitle': 'Network error',

    // Quotes — decline (GAP-AUDIT #1)
    'quotes.decline': 'Decline',
    'quotes.declined': 'Quote declined',
    'quotes.declineError': 'Could not decline quote',

    // Disputes — my disputes list (GAP-AUDIT #6)
    'disputes.title': 'My Disputes',
    'disputes.empty': 'No disputes',
    'disputes.emptyBody': "You haven't filed or received any disputes.",
    'disputes.loadError': 'Could not load disputes',
    'disputes.statusOpen': 'Open',
    'disputes.statusUnderReview': 'Under review',
    'disputes.statusResolved': 'Resolved',
    'disputes.statusDismissed': 'Dismissed',
    'disputes.filedByYou': 'Filed by you',
    'disputes.filedAgainstYou': 'Filed against you',
    'disputes.viewLink': 'My disputes',

    // Escrow status — read-only (GAP-AUDIT #10). A single current state, not
    // a ladder — see the EscrowStatus comment in BookingDetailsScreen.js.
    // escrow.halfReleased used to live here ("Released when you approve");
    // removed 2026-08-09 — paired with fullReleased it described a staged
    // 50%-now/50%-later release that was never real (escrow.py: one charge,
    // one release).
    'escrow.title': 'Payment protection',
    'escrow.fundsHeld': 'Funds held in escrow',
    'escrow.fullReleased': 'Released on completion',
    'escrow.status.unpaid': 'Payment due',
    'escrow.status.heldBody': "Released once you approve the work, or automatically 24 hours after it's marked done.",
    'escrow.status.offPlatform': 'Paid directly to the business',
    'escrow.status.refunded': 'Refunded',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'Uploading photo…',
    'profile.photoUpdated': 'Photo updated',
    'profile.photoUploadError': 'Could not upload photo',
    'profile.photoPermission': 'Allow Swingbyy to access your photos to set a profile picture.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'Uploading…',
    'dispute.photoUploadError': 'Could not upload photo',
    'dispute.photoPermission': 'Allow Swingbyy to access your photos to attach evidence.',
    'dispute.addPhoto': 'Add photo',
    'dispute.photosOptional': 'Optional — add up to 3 photos as evidence.',

    // Business profile — distance + completeness meter (missing-key audit)
    'businessProfile.distanceAway': '%{km} km away',
    'businessProfile.completenessLabel': 'Profile completeness',
    'businessProfile.completenessTipDescription': 'Add a description to help clients find you.',
    'businessProfile.completenessTipPhotos': 'Add photos of your work to build trust.',
    'businessProfile.completenessTipServices': 'List the services you offer.',
    'businessProfile.completenessTipRadius': 'Set your service radius so clients nearby can find you.',

    // Job management — business "Jobs" tab (New/Quoted/Scheduled) (missing-key audit)
    'jobManagement.title': 'Jobs',
    'jobManagement.errorTitle': 'Could not load your jobs',
    'jobManagement.messageAction': 'Message',
    'jobManagement.interestPending': 'Pending',
    'jobManagement.interestAccepted': 'Accepted',
    'jobManagement.interestRejected': 'Declined',
    'jobManagement.filterNew': 'New',
    'jobManagement.filterQuoted': 'Quoted',
    'jobManagement.filterScheduled': 'Scheduled',
    'jobManagement.emptyNewTitle': 'No new leads',
    'jobManagement.emptyNewBody': 'New job posts near you will show up here.',
    'jobManagement.emptyQuotedTitle': 'No quotes sent yet',
    'jobManagement.emptyQuotedBody': 'Quotes you send on new leads will appear here.',
    'jobManagement.emptyScheduledTitle': 'No scheduled jobs',
    'jobManagement.emptyScheduledBody': 'Jobs you have booked will appear here.',

    // Profile — invite friends badge (missing-key audit)
    'profile.inviteBadge': 'New',

    // Jobs view — operational hub (CARD-24: Today/Upcoming/Needs action/Past)
    'jobManagement.filterToday': 'Today',
    'jobManagement.filterUpcoming': 'Upcoming',
    'jobManagement.filterNeedsAction': 'Needs action',
    'jobManagement.filterPast': 'Past',
    'jobManagement.emptyTodayTitle': 'Nothing scheduled today',
    'jobManagement.emptyTodayBody': 'Jobs confirmed for today will show up here.',
    'jobManagement.emptyUpcomingTitle': 'No upcoming jobs',
    'jobManagement.emptyUpcomingBody': 'Jobs confirmed for later will show up here.',
    'jobManagement.emptyNeedsActionTitle': "You're all caught up",
    'jobManagement.emptyNeedsActionBody': 'New leads, quotes, and bookings that need you will show up here.',
    'jobManagement.emptyPastTitle': 'No past jobs yet',
    'jobManagement.emptyPastBody': 'Completed and cancelled jobs will appear here, each linked to its invoice.',
    'jobManagement.needsActionNewLeads': 'New requests',
    'jobManagement.needsActionBookings': 'Bookings needing you',
    'jobManagement.needsActionQuotesSent': 'Quotes awaiting response',
    'jobManagement.needsActionUnassigned': 'Needs an employee',
    'jobManagement.needsActionProposeDate': 'Propose a time',
    'jobManagement.needsActionAwaitingDate': 'Awaiting date confirmation',
    'jobManagement.viewInvoice': 'View invoice',

    // Dashboard — next job / money in flight (CARD-24)
    'dashboard.nextJobTitle': 'Next job',
    'dashboard.nextJobNone': 'No upcoming jobs scheduled',
    'dashboard.moneyInFlightTitle': 'Money in flight',
    'dashboard.moneyHeld': 'Held in escrow',
    'dashboard.moneyCleared': 'Cleared',
    // M5 — the hero counts money released to you, not gross booking value.
    'dashboard.heroCaption': 'cleared to you',
    'dashboard.moneyUnavailable': 'Could not load payment totals',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'Unlock Swingbyy',
    'biometric.lockedBody': 'Use Face ID, Touch ID, or your fingerprint to continue.',
    'biometric.unlockCta': 'Unlock',
    'biometric.declinedHint': "Didn't work? Try again or sign in differently.",
    'biometric.useDifferentAccount': 'Sign in differently',
    'biometric.prompt': 'Unlock Swingbyy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'Face ID / Fingerprint Unlock',
    'settings.biometricUnavailableHint': 'Not set up on this device',
    'settings.biometricUnavailableTitle': 'Not available',
    'settings.biometricUnavailableBody': "Face ID / fingerprint isn't set up on this device yet. Enable it in your device settings, then try again.",
    'settings.biometricConfirmPrompt': 'Confirm to enable biometric unlock',
    // Rebook — one-tap repeat booking from a completed job (CARD-12)
    'rebook.button': 'Rebook',
    'rebook.bannerTitle': 'Rebooking %{business}',
    'rebook.descriptionTemplate': 'Rebooking %{business} — same job as last time. Add any new details below.',

    // Favorites — save a business for later (CARD-12)
    'favorites.add': 'Save to favorites',
    'favorites.remove': 'Remove from favorites',
    'favorites.added': 'Saved to favorites',
    'favorites.removed': 'Removed from favorites',
    // CARD-20 (D2) — booking-entry flow: disappearing chat banner + the
    // floating booking badge that replaced the old plain "Booking"/"Quote"
    // label in the Messages list.
    'chat.disappearingBanner': 'Agree on a time to turn this into your booking chat.',
    'messages.badgeQuote': 'Quote',
    'messages.badgeBooking': 'Booking',
    'messages.badgeBookingPending': 'Pending time',
    'messages.badgeBookingA11y': 'Open booking details',
    // ── Lane 2 · Messages + quotes (canvas 5a / 3a) ────────────────────────
    // The inbox holds BOOKED WORK ONLY; everything still being negotiated
    // sits behind the docked Quotes bubble.
    'messages.title': 'Messages',
    'messages.quotesTitle': 'Quotes',
    'messages.sentQuotesTitle': 'Sent quotes',
    'messages.quotesSubtitleClient': '%{n} open · not booked yet',
    'messages.quotesSubtitleBusiness': '%{n} out · %{amount} pending',
    'messages.bookedSection': 'Booked jobs',
    'messages.searchPlaceholder': 'Search conversations',
    'messages.bubbleQuotes': 'Quotes',
    'messages.bubbleSent': 'Sent quotes',
    'messages.bubbleBack': 'Back to chats',
    'messages.now': 'now',
    'messages.chatFallback': 'Chat',
    'messages.clientFallback': 'Client',
    'messages.businessFallback': 'Business',
    'messages.jobFallback': 'Job post',
    'messages.noMessagesYet': 'No messages yet',
    'messages.metaToday': 'Today · %{time}',
    'messages.metaUpcoming': 'Upcoming · %{date}',
    'messages.metaCompleted': 'Completed',
    'messages.metaCompletedOn': 'Completed · %{date}',
    'messages.metaInProgress': 'In progress',
    'messages.metaAwaitingTime': 'Awaiting a time',
    'messages.quoteAwaitingYou': 'Waiting on you',
    'messages.quoteExpiresIn': 'Expires in %{left}',
    'messages.quoteExpiresInDays': 'Expires in %{n} d',
    'messages.quoteAwaitingReply': 'Awaiting reply',
    'messages.quoteAwaitingReplyLeft': 'Awaiting reply · %{left} left',
    'messages.quoteAwaitingTheirs': 'Awaiting their quote',
    'messages.quoteRequested': 'Requested %{when}',
    'messages.quoteDeclined': 'Declined',
    'messages.quoteYouDeclined': 'You declined',
    'messages.quoteExpired': 'Expired',
    'messages.quotesFooterClient': 'Accepted quotes move into Messages as booked jobs.',
    'messages.quotesFooterBusiness': 'Accepted quotes appear in Jobs — only then.',
    'messages.emptyChatsTitle': 'No booked jobs yet',
    'messages.emptyChatsBody': 'A chat opens here the moment a quote is accepted and paid.',
    'messages.emptyQuotesTitle': 'No open quotes',
    'messages.emptyQuotesBodyClient': 'Quotes you receive land here until you accept one.',
    'messages.emptyQuotesBodyBusiness': 'Quotes you send land here until the client replies.',
    'messages.emptySearchTitle': 'No results',
    'messages.emptySearchBody': 'No booked jobs match "%{query}".',
    'messages.errorTitle': "Couldn't load your inbox",
    'messages.loadError': 'Check your connection and try again.',
    'chat.quoteNotBooked': 'Quote · not booked yet',
    'quoteCard.eyebrow': 'Quote',
    'quoteCard.eyebrowSent': 'Quote sent',
    'quoteCard.service': 'Service',
    'quoteCard.when': 'When',
    'quoteCard.expires': 'Expires',
    'quoteCard.statusLabel': 'Status',
    'quoteCard.awaitingReply': 'Awaiting reply · %{left} left',
    'quoteCard.expired': 'expired',
    'quoteCard.inMinutes': 'in %{n} min',
    'quoteCard.inHours': 'in %{n} h',
    'quoteCard.inDays': 'in %{n} d',
    'quoteCard.payNote': "You pay now — you'll see the total before you confirm.",
    'quoteCard.decline': 'Decline',
    'quoteCard.acceptAndPay': 'Accept & pay',
    'quoteCard.declineError': "Couldn't decline that quote",
    'quoteCard.withdraw': 'Withdraw',
    'quoteCard.editQuote': 'Edit quote',
    'quoteCard.sentLocked': "Changing a sent quote isn't available yet — message the client instead.",
    'quoteCard.acceptedTitle': 'Accepted · %{amount} paid',
    'quoteCard.acceptedWhen': 'Now a booking · %{when}',
    'quoteCard.acceptedNow': 'Now a booking',
    'quoteCard.view': 'View',
    'quoteCard.expiredTitle': 'Quote expired · %{amount}',
    'quoteCard.expiredBody': 'Ask for a new one',
    'quoteCard.reRequest': 'Re-request',
    'quoteCard.declinedTitle': 'Quote declined · %{amount}',
    'quoteCard.declinedBody': 'You can keep chatting',
    'jobManagement.sentQuotesMoved': 'Sent quotes live in Messages, behind the Quotes bubble. A job lands here on acceptance.',
  },

  'fr-CA': {
    // Auth
    'auth.signin': 'Se connecter',
    'auth.signup': 'Créer un compte',
    'auth.logout': 'Se déconnecter',
    'auth.email': 'Adresse courriel',
    'auth.password': 'Mot de passe',
    'auth.forgotPassword': 'Mot de passe oublié?',
    'auth.noAccount': "Vous n'avez pas de compte?",
    'auth.hasAccount': 'Vous avez déjà un compte?',
    'auth.login': 'Se connecter',

    // Common
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.confirm': 'Confirmer',
    'common.back': 'Retour',
    'common.loading': 'Chargement…',
    'common.error': "Une erreur s'est produite",
    'common.retry': 'Réessayer',
    'common.done': 'Terminer',
    'common.edit': 'Modifier',
    'common.share': 'Partager',
    'common.copy': 'Copier',
    'common.copied': 'Copié',
    'common.comingSoon': 'Bientôt disponible',

    // Settings
    'settings.title': 'Paramètres',
    'settings.language': 'Langue',
    'settings.languageTitle': 'Choisir la langue',
    'settings.notifications': 'Notifications',
    'settings.account': 'Compte',
    'settings.privacy': 'Confidentialité et droit',
    'settings.support': 'Assistance',
    'settings.editProfile': 'Modifier le profil',
    'settings.privacyPolicy': 'Politique de confidentialité',
    'settings.termsOfService': "Conditions d'utilisation",
    'settings.exportData': 'Exporter mes données',
    'settings.deleteAccount': 'Supprimer mon compte',
    'settings.helpFAQ': 'Aide et FAQ',
    'settings.contactUs': 'Nous contacter',
    'settings.signOut': 'Se déconnecter',
    'settings.version': 'Version',

    // Profile
    'profile.title': 'Modifier le profil',
    'profile.firstName': 'Prénom',
    'profile.lastName': 'Nom de famille',
    'profile.email': 'Courriel',
    'profile.emailLocked': 'Courriel — contactez le support pour modifier',
    'profile.phone': 'Téléphone',
    'profile.saveChanges': 'Enregistrer les modifications',
    'profile.updated': 'Profil mis à jour',
    'profile.updateError': 'Impossible de sauvegarder les modifications',
    'profile.photoComingSoon': "Téléchargement de photo à venir",

    // Onboarding
    'onboarding.skip': 'Passer',
    'onboarding.getStarted': 'Commencer',
    'onboarding.slide1Title': 'Des pros locaux, à la demande',
    'onboarding.slide1Sub': 'Plomberie, nettoyage, pelouse et plus — devis par des entreprises locales de confiance.',
    'onboarding.slide2Title': 'Vous fixez le jour, ils font des offres',
    'onboarding.slide2Sub': 'Publiez une fois. Comparez les devis. Choisissez le meilleur.',
    'onboarding.slide3Title': 'Des travailleurs vérifiés, à chaque fois',
    'onboarding.slide3Sub': "Preuve photo à la fin du travail. L'entiercement protège votre paiement.",

    // Referral
    'referral.title': 'Partagez Swingbyy, obtenez 10$ de crédit',
    'referral.body': 'Quand votre ami complète sa première réservation, vous recevez tous les deux 10$ de rabais.',
    'referral.shareText': 'Rejoignez-moi sur Swingbyy! Code: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'Partager mon code',
    'referral.stats': '%{friends} amis inscrits • %{earned}$ gagnés',

    // FAQ
    'faq.title': 'Aide et FAQ',
    'faq.q1': 'Comment fonctionne Swingbyy?',
    'faq.q2': 'Comment les devis sont-ils acceptés?',
    'faq.q3': "Quand le paiement a-t-il lieu?",
    'faq.q4': "Que se passe-t-il si un travail tourne mal?",
    'faq.q5': 'Comment devenir une entreprise?',
    'faq.q6': 'Comment supprimer mon compte?',

    // Booking — confirm-date handshake (chat thread + booking details)
    'booking.proposedDatesHeading': "L'entreprise a proposé ces horaires",
    'booking.proposedTimesHeading': 'Horaires proposés — touchez pour accepter',
    'booking.waitingOtherSide': "Horaires envoyés — en attente de l'autre partie",
    'booking.proposeTimesHeading': 'Convenir d’un horaire',
    'booking.proposeTimes': 'Proposer un horaire',
    'booking.addAnotherTime': 'Ajouter un autre horaire',
    'booking.sendProposal': 'Envoyer la proposition',
    'booking.proposalSentToast': 'Horaires proposés',
    'booking.proposeErrorToast': "Impossible d'envoyer les horaires",
    'booking.confirmedFor': 'Confirmé pour le %{date}',
    'booking.dateConfirmedToast': 'Date confirmée',
    'booking.confirmDateErrorToast': 'Impossible de confirmer la date',
    'booking.viewFullDetails': 'Voir tous les détails',
    'booking.detailsAction': 'Détails',

    // Job opportunity card / quote sheet — client-uploaded photos (business side)
    'jobCard.photosLabel': 'Photos (%{count})',
    'jobCard.photoAlt': 'Photo du travail %{index} sur %{count}',
    'imageViewer.close': 'Fermer',

    // Post a job — category picker
    'postJob.categoryOther': 'Autre / Général',

    // Search — name-based business search
    'search.placeholder': 'Rechercher des entreprises, catégories…',
    'search.recent': 'RÉCENTS',
    'search.idleTitle': 'Trouver des pros locaux',
    'search.idleBody': "Saisissez un nom d'entreprise ou une catégorie",
    'search.noMatchesTitle': 'Aucun résultat',
    'search.noMatchesBody': 'Aucun résultat pour « %{query} »',
    'search.clear': 'Effacer la recherche',
    'search.errorTitle': 'Erreur réseau',

    // Quotes — decline (GAP-AUDIT #1)
    'quotes.decline': 'Refuser',
    'quotes.declined': 'Devis refusé',
    'quotes.declineError': 'Impossible de refuser le devis',

    // Disputes — my disputes list (GAP-AUDIT #6)
    'disputes.title': 'Mes litiges',
    'disputes.empty': 'Aucun litige',
    'disputes.emptyBody': "Vous n'avez déposé ou reçu aucun litige.",
    'disputes.loadError': 'Impossible de charger les litiges',
    'disputes.statusOpen': 'Ouvert',
    'disputes.statusUnderReview': 'En cours de révision',
    'disputes.statusResolved': 'Résolu',
    'disputes.statusDismissed': 'Rejeté',
    'disputes.filedByYou': 'Déposé par vous',
    'disputes.filedAgainstYou': 'Déposé contre vous',
    'disputes.viewLink': 'Mes litiges',

    // Escrow status — read-only (GAP-AUDIT #10)
    'escrow.title': 'Protection du paiement',
    'escrow.fundsHeld': 'Fonds détenus en entiercement',
    'escrow.fullReleased': 'Libéré à la fin du travail',
    'escrow.status.unpaid': 'Paiement dû',
    'escrow.status.heldBody': 'Libéré dès que vous approuvez le travail, ou automatiquement 24 heures après qu’il soit marqué terminé.',
    'escrow.status.offPlatform': 'Payé directement à l’entreprise',
    'escrow.status.refunded': 'Remboursé',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'Téléchargement de la photo…',
    'profile.photoUpdated': 'Photo mise à jour',
    'profile.photoUploadError': 'Impossible de télécharger la photo',
    'profile.photoPermission': 'Autorisez Swingbyy à accéder à vos photos pour définir une photo de profil.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'Téléchargement…',
    'dispute.photoUploadError': 'Impossible de télécharger la photo',
    'dispute.photoPermission': 'Autorisez Swingbyy à accéder à vos photos pour joindre des preuves.',
    'dispute.addPhoto': 'Ajouter une photo',
    'dispute.photosOptional': 'Facultatif — ajoutez jusqu\'à 3 photos comme preuve.',

    // Business profile — distance + completeness meter (missing-key audit)
    'businessProfile.distanceAway': 'À %{km} km',
    'businessProfile.completenessLabel': 'Complétude du profil',
    'businessProfile.completenessTipDescription': 'Ajoutez une description pour aider les clients à vous trouver.',
    'businessProfile.completenessTipPhotos': 'Ajoutez des photos de vos travaux pour bâtir la confiance.',
    'businessProfile.completenessTipServices': 'Énumérez les services que vous offrez.',
    'businessProfile.completenessTipRadius': "Définissez votre rayon de service pour que les clients à proximité puissent vous trouver.",

    // Job management — business "Jobs" tab (New/Quoted/Scheduled) (missing-key audit)
    'jobManagement.title': 'Travaux',
    'jobManagement.errorTitle': 'Impossible de charger vos travaux',
    'jobManagement.messageAction': 'Message',
    'jobManagement.interestPending': 'En attente',
    'jobManagement.interestAccepted': 'Accepté',
    'jobManagement.interestRejected': 'Refusé',
    'jobManagement.filterNew': 'Nouveaux',
    'jobManagement.filterQuoted': 'Devis envoyés',
    'jobManagement.filterScheduled': 'Planifiés',
    'jobManagement.emptyNewTitle': 'Aucun nouveau prospect',
    'jobManagement.emptyNewBody': 'Les nouvelles publications près de vous apparaîtront ici.',
    'jobManagement.emptyQuotedTitle': 'Aucun devis envoyé',
    'jobManagement.emptyQuotedBody': 'Les devis que vous envoyez sur de nouveaux prospects apparaîtront ici.',
    'jobManagement.emptyScheduledTitle': 'Aucun travail planifié',
    'jobManagement.emptyScheduledBody': 'Les travaux que vous avez réservés apparaîtront ici.',

    // Profile — invite friends badge (missing-key audit)
    'profile.inviteBadge': 'Nouveau',

    // Jobs view — operational hub (CARD-24: Today/Upcoming/Needs action/Past)
    'jobManagement.filterToday': "Aujourd'hui",
    'jobManagement.filterUpcoming': 'À venir',
    'jobManagement.filterNeedsAction': 'Nécessite une action',
    'jobManagement.filterPast': 'Passés',
    'jobManagement.emptyTodayTitle': "Rien de prévu aujourd'hui",
    'jobManagement.emptyTodayBody': "Les travaux confirmés pour aujourd'hui apparaîtront ici.",
    'jobManagement.emptyUpcomingTitle': 'Aucun travail à venir',
    'jobManagement.emptyUpcomingBody': 'Les travaux confirmés pour plus tard apparaîtront ici.',
    'jobManagement.emptyNeedsActionTitle': 'Tout est à jour',
    'jobManagement.emptyNeedsActionBody': 'Les nouveaux prospects, devis et réservations qui ont besoin de vous apparaîtront ici.',
    'jobManagement.emptyPastTitle': 'Aucun travail passé',
    'jobManagement.emptyPastBody': 'Les travaux terminés et annulés apparaîtront ici, chacun lié à sa facture.',
    'jobManagement.needsActionNewLeads': 'Nouvelles demandes',
    'jobManagement.needsActionBookings': 'Réservations nécessitant une action',
    'jobManagement.needsActionQuotesSent': 'Devis en attente de réponse',
    'jobManagement.needsActionUnassigned': 'Nécessite un employé',
    'jobManagement.needsActionProposeDate': 'Proposer une heure',
    'jobManagement.needsActionAwaitingDate': 'En attente de confirmation de date',
    'jobManagement.viewInvoice': 'Voir la facture',

    // Dashboard — next job / money in flight (CARD-24)
    'dashboard.nextJobTitle': 'Prochain travail',
    'dashboard.nextJobNone': 'Aucun travail à venir prévu',
    'dashboard.moneyInFlightTitle': 'Argent en transit',
    'dashboard.moneyHeld': 'Retenu en fiducie',
    'dashboard.moneyCleared': 'Libéré',
    'dashboard.heroCaption': 'versé à vous',
    'dashboard.moneyUnavailable': 'Impossible de charger les totaux de paiement',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'Déverrouiller Swingbyy',
    'biometric.lockedBody': 'Utilisez Face ID, Touch ID ou votre empreinte digitale pour continuer.',
    'biometric.unlockCta': 'Déverrouiller',
    'biometric.declinedHint': "Ça n'a pas fonctionné? Réessayez ou connectez-vous autrement.",
    'biometric.useDifferentAccount': 'Se connecter autrement',
    'biometric.prompt': 'Déverrouiller Swingbyy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'Déverrouillage par Face ID / empreinte',
    'settings.biometricUnavailableHint': 'Non configuré sur cet appareil',
    'settings.biometricUnavailableTitle': 'Non disponible',
    'settings.biometricUnavailableBody': "Face ID ou l'empreinte digitale n'est pas encore configuré sur cet appareil. Activez-le dans les paramètres de votre appareil, puis réessayez.",
    'settings.biometricConfirmPrompt': 'Confirmez pour activer le déverrouillage biométrique',
    // Rebook — one-tap repeat booking from a completed job (CARD-12)
    'rebook.button': 'Réserver à nouveau',
    'rebook.bannerTitle': 'Nouvelle réservation avec %{business}',
    'rebook.descriptionTemplate': 'Nouvelle réservation avec %{business} — même travail que la dernière fois. Ajoutez des détails ci-dessous.',

    // Favorites — save a business for later (CARD-12)
    'favorites.add': 'Ajouter aux favoris',
    'favorites.remove': 'Retirer des favoris',
    'favorites.added': 'Ajouté aux favoris',
    'favorites.removed': 'Retiré des favoris',
    // CARD-20 (D2) — booking-entry flow: disappearing chat banner + the
    // floating booking badge that replaced the old plain "Booking"/"Quote"
    // label in the Messages list.
    'chat.disappearingBanner': 'Convenez d’un horaire pour transformer ceci en votre clavardage de réservation.',
    'messages.badgeQuote': 'Devis',
    'messages.badgeBooking': 'Réservation',
    'messages.badgeBookingPending': 'Horaire à confirmer',
    'messages.badgeBookingA11y': 'Voir les détails de la réservation',
    // ── Lane 2 · Messagerie + devis (5a / 3a) ──────────────────────────────
    'messages.title': 'Messages',
    'messages.quotesTitle': 'Devis',
    'messages.sentQuotesTitle': 'Devis envoyés',
    'messages.quotesSubtitleClient': '%{n} en attente · pas encore réservé',
    'messages.quotesSubtitleBusiness': '%{n} envoyés · %{amount} en attente',
    'messages.bookedSection': 'Travaux réservés',
    'messages.searchPlaceholder': 'Rechercher une conversation',
    'messages.bubbleQuotes': 'Devis',
    'messages.bubbleSent': 'Devis envoyés',
    'messages.bubbleBack': 'Retour aux discussions',
    'messages.now': 'maintenant',
    'messages.chatFallback': 'Discussion',
    'messages.clientFallback': 'Client',
    'messages.businessFallback': 'Entreprise',
    'messages.jobFallback': 'Annonce',
    'messages.noMessagesYet': 'Aucun message',
    'messages.metaToday': "Aujourd'hui · %{time}",
    'messages.metaUpcoming': 'À venir · %{date}',
    'messages.metaCompleted': 'Terminé',
    'messages.metaCompletedOn': 'Terminé · %{date}',
    'messages.metaInProgress': 'En cours',
    'messages.metaAwaitingTime': 'En attente d’un horaire',
    'messages.quoteAwaitingYou': 'En attente de votre réponse',
    'messages.quoteExpiresIn': 'Expire dans %{left}',
    'messages.quoteExpiresInDays': 'Expire dans %{n} j',
    'messages.quoteAwaitingReply': 'En attente de réponse',
    'messages.quoteAwaitingReplyLeft': 'En attente · %{left} restantes',
    'messages.quoteAwaitingTheirs': 'En attente de leur devis',
    'messages.quoteRequested': 'Demandé %{when}',
    'messages.quoteDeclined': 'Refusé',
    'messages.quoteYouDeclined': 'Vous avez refusé',
    'messages.quoteExpired': 'Expiré',
    'messages.quotesFooterClient': 'Les devis acceptés deviennent des travaux réservés dans Messages.',
    'messages.quotesFooterBusiness': 'Les devis acceptés apparaissent dans Travaux — pas avant.',
    'messages.emptyChatsTitle': 'Aucun travail réservé',
    'messages.emptyChatsBody': 'Une discussion s’ouvre ici dès qu’un devis est accepté et payé.',
    'messages.emptyQuotesTitle': 'Aucun devis en cours',
    'messages.emptyQuotesBodyClient': 'Les devis reçus restent ici jusqu’à ce que vous en acceptiez un.',
    'messages.emptyQuotesBodyBusiness': 'Les devis envoyés restent ici jusqu’à la réponse du client.',
    'messages.emptySearchTitle': 'Aucun résultat',
    'messages.emptySearchBody': 'Aucun travail réservé ne correspond à « %{query} ».',
    'messages.errorTitle': 'Impossible de charger votre boîte de réception',
    'messages.loadError': 'Vérifiez votre connexion et réessayez.',
    'chat.quoteNotBooked': 'Devis · pas encore réservé',
    'quoteCard.eyebrow': 'Devis',
    'quoteCard.eyebrowSent': 'Devis envoyé',
    'quoteCard.service': 'Service',
    'quoteCard.when': 'Quand',
    'quoteCard.expires': 'Expire',
    'quoteCard.statusLabel': 'Statut',
    'quoteCard.awaitingReply': 'En attente · %{left} restantes',
    'quoteCard.expired': 'expiré',
    'quoteCard.inMinutes': 'dans %{n} min',
    'quoteCard.inHours': 'dans %{n} h',
    'quoteCard.inDays': 'dans %{n} j',
    'quoteCard.payNote': 'Vous payez maintenant — le total s’affiche avant la confirmation.',
    'quoteCard.decline': 'Refuser',
    'quoteCard.acceptAndPay': 'Accepter et payer',
    'quoteCard.declineError': 'Impossible de refuser ce devis',
    'quoteCard.withdraw': 'Retirer',
    'quoteCard.editQuote': 'Modifier le devis',
    'quoteCard.sentLocked': 'La modification d’un devis envoyé n’est pas encore disponible — écrivez au client.',
    'quoteCard.acceptedTitle': 'Accepté · %{amount} payé',
    'quoteCard.acceptedWhen': 'Devenu une réservation · %{when}',
    'quoteCard.acceptedNow': 'Devenu une réservation',
    'quoteCard.view': 'Voir',
    'quoteCard.expiredTitle': 'Devis expiré · %{amount}',
    'quoteCard.expiredBody': 'Demandez-en un nouveau',
    'quoteCard.reRequest': 'Redemander',
    'quoteCard.declinedTitle': 'Devis refusé · %{amount}',
    'quoteCard.declinedBody': 'Vous pouvez continuer à discuter',
    'jobManagement.sentQuotesMoved': 'Les devis envoyés se trouvent dans Messages, derrière la bulle Devis. Un travail arrive ici à l’acceptation.',
  },

  // ── Arabic (RTL) — skeleton keys, translator TODO ──────────────────────
  ar: {
    // Auth
    'auth.signin': 'تسجيل الدخول',
    'auth.signup': 'إنشاء حساب',
    'auth.logout': 'تسجيل الخروج',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.noAccount': 'ليس لديك حساب؟',
    'auth.hasAccount': 'لديك حساب بالفعل؟',
    'auth.login': 'تسجيل الدخول',

    // Common
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.confirm': 'تأكيد',
    'common.back': 'رجوع',
    'common.loading': 'جارٍ التحميل…',
    'common.error': 'حدث خطأ ما',
    'common.retry': 'حاول مجدداً',
    'common.done': 'تم',
    'common.edit': 'تعديل',
    'common.share': 'مشاركة',
    'common.copy': 'نسخ',
    'common.copied': 'تم النسخ',
    'common.comingSoon': 'قريباً',

    // Settings
    'settings.title': 'الإعدادات',
    'settings.language': 'اللغة',
    'settings.languageTitle': 'اختر اللغة',
    'settings.notifications': 'الإشعارات',
    'settings.account': 'الحساب',
    'settings.privacy': 'الخصوصية والقانون',
    'settings.support': 'الدعم',
    'settings.editProfile': 'تعديل الملف الشخصي',
    'settings.privacyPolicy': 'سياسة الخصوصية',
    'settings.termsOfService': 'شروط الخدمة',
    'settings.exportData': 'تصدير بياناتي',
    'settings.deleteAccount': 'حذف حسابي',
    'settings.helpFAQ': 'المساعدة والأسئلة الشائعة',
    'settings.contactUs': 'اتصل بنا',
    'settings.signOut': 'تسجيل الخروج',
    'settings.version': 'الإصدار',

    // Profile
    'profile.title': 'تعديل الملف الشخصي',
    'profile.firstName': 'الاسم الأول',
    'profile.lastName': 'اسم العائلة',
    'profile.email': 'البريد الإلكتروني',
    'profile.emailLocked': 'البريد الإلكتروني — تواصل مع الدعم للتغيير',
    'profile.phone': 'رقم الهاتف',
    'profile.saveChanges': 'حفظ التغييرات',
    'profile.updated': 'تم تحديث الملف الشخصي',
    'profile.updateError': 'تعذر حفظ التغييرات',
    'profile.photoComingSoon': 'رفع الصور قريباً',

    // Onboarding
    'onboarding.skip': 'تخطي',
    'onboarding.getStarted': 'ابدأ',
    'onboarding.slide1Title': 'محترفون محليون، عند الطلب',
    'onboarding.slide1Sub': 'سباكة، تنظيف، عشب وأكثر — عروض أسعار من شركات محلية موثوقة.',
    'onboarding.slide2Title': 'أنت تحدد اليوم، وهم يتنافسون',
    'onboarding.slide2Sub': 'انشر مرة واحدة. قارن العروض. اختر الأفضل.',
    'onboarding.slide3Title': 'عمال موثوقون في كل مرة',
    'onboarding.slide3Sub': 'دليل صوري عند اكتمال العمل. الضمان يحمي دفعتك.',

    // Referral
    'referral.title': 'شارك Swingbyy واحصل على 10 دولار رصيد',
    'referral.body': 'عندما يُكمل صديقك حجزه الأول، تحصلان معاً على 10 دولار خصماً.',
    'referral.shareText': 'انضم إليّ على Swingbyy! الكود: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'شارك كودي',
    'referral.stats': '%{friends} أصدقاء انضموا • %{earned}$ مكسبة',

    // FAQ
    'faq.title': 'المساعدة والأسئلة الشائعة',
    'faq.q1': 'كيف يعمل Swingbyy؟',
    'faq.q2': 'كيف تُقبَل العروض؟',
    'faq.q3': 'متى يتم الدفع؟',
    'faq.q4': 'ماذا يحدث إذا ساءت الأمور؟',
    'faq.q5': 'كيف أصبح صاحب عمل؟',
    'faq.q6': 'كيف أحذف حسابي؟',

    // Booking — confirm-date handshake (chat thread + booking details)
    'booking.proposedDatesHeading': 'اقترحت الشركة هذه الأوقات',
    'booking.proposedTimesHeading': 'الأوقات المقترحة — اضغط للقبول',
    'booking.waitingOtherSide': 'تم إرسال الأوقات — بانتظار موافقة الطرف الآخر',
    'booking.proposeTimesHeading': 'الاتفاق على وقت',
    'booking.proposeTimes': 'اقترح وقتًا',
    'booking.addAnotherTime': 'أضف وقتًا آخر',
    'booking.sendProposal': 'إرسال الاقتراح',
    'booking.proposalSentToast': 'تم اقتراح الأوقات',
    'booking.proposeErrorToast': 'تعذر إرسال الأوقات المقترحة',
    'booking.confirmedFor': 'تم التأكيد بتاريخ %{date}',
    'booking.dateConfirmedToast': 'تم تأكيد التاريخ',
    'booking.confirmDateErrorToast': 'تعذر تأكيد التاريخ',
    'booking.viewFullDetails': 'عرض كل التفاصيل',
    'booking.detailsAction': 'التفاصيل',

    // Job opportunity card / quote sheet — client-uploaded photos (business side)
    'jobCard.photosLabel': 'الصور (%{count})',
    'jobCard.photoAlt': 'صورة العمل %{index} من %{count}',
    'imageViewer.close': 'إغلاق',

    // Post a job — category picker
    'postJob.categoryOther': 'أخرى / عام',

    // Search — name-based business search
    'search.placeholder': 'ابحث عن الشركات أو الفئات…',
    'search.recent': 'الأخيرة',
    'search.idleTitle': 'ابحث عن محترفين محليين',
    'search.idleBody': 'اكتب اسم شركة أو فئة',
    'search.noMatchesTitle': 'لا توجد نتائج',
    'search.noMatchesBody': 'لا نتائج لـ "%{query}"',
    'search.clear': 'مسح البحث',
    'search.errorTitle': 'خطأ في الشبكة',

    // Quotes — decline (GAP-AUDIT #1)
    'quotes.decline': 'رفض',
    'quotes.declined': 'تم رفض العرض',
    'quotes.declineError': 'تعذر رفض العرض',

    // Disputes — my disputes list (GAP-AUDIT #6)
    'disputes.title': 'نزاعاتي',
    'disputes.empty': 'لا توجد نزاعات',
    'disputes.emptyBody': 'لم تقدم أو تستلم أي نزاعات.',
    'disputes.loadError': 'تعذر تحميل النزاعات',
    'disputes.statusOpen': 'مفتوح',
    'disputes.statusUnderReview': 'قيد المراجعة',
    'disputes.statusResolved': 'تم الحل',
    'disputes.statusDismissed': 'مرفوض',
    'disputes.filedByYou': 'قدمته أنت',
    'disputes.filedAgainstYou': 'قُدّم ضدك',
    'disputes.viewLink': 'نزاعاتي',

    // Escrow status — read-only (GAP-AUDIT #10)
    'escrow.title': 'حماية الدفع',
    'escrow.fundsHeld': 'الأموال محتجزة كضمان',
    'escrow.fullReleased': 'تم التحرير عند الاكتمال',
    'escrow.status.unpaid': 'الدفع مستحق',
    'escrow.status.heldBody': 'يُحرَّر بمجرد موافقتك على العمل، أو تلقائيًا بعد 24 ساعة من تحديده كمكتمل.',
    'escrow.status.offPlatform': 'دُفع مباشرة إلى الشركة',
    'escrow.status.refunded': 'تم استرداد المبلغ',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'جارٍ رفع الصورة…',
    'profile.photoUpdated': 'تم تحديث الصورة',
    'profile.photoUploadError': 'تعذر رفع الصورة',
    'profile.photoPermission': 'اسمح لـ Swingbyy بالوصول إلى صورك لتعيين صورة الملف الشخصي.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'جارٍ الرفع…',
    'dispute.photoUploadError': 'تعذر رفع الصورة',
    'dispute.photoPermission': 'اسمح لـ Swingbyy بالوصول إلى صورك لإرفاق الأدلة.',
    'dispute.addPhoto': 'إضافة صورة',
    'dispute.photosOptional': 'اختياري — أضف حتى 3 صور كدليل.',

    // Business profile — distance + completeness meter (missing-key audit)
    'businessProfile.distanceAway': 'على بعد %{km} كم',
    'businessProfile.completenessLabel': 'اكتمال الملف الشخصي',
    'businessProfile.completenessTipDescription': 'أضف وصفاً لمساعدة العملاء في العثور عليك.',
    'businessProfile.completenessTipPhotos': 'أضف صوراً لأعمالك لبناء الثقة.',
    'businessProfile.completenessTipServices': 'اذكر الخدمات التي تقدمها.',
    'businessProfile.completenessTipRadius': 'حدد نطاق خدمتك ليتمكن العملاء القريبون من العثور عليك.',

    // Job management — business "Jobs" tab (New/Quoted/Scheduled) (missing-key audit)
    'jobManagement.title': 'الأعمال',
    'jobManagement.errorTitle': 'تعذر تحميل أعمالك',
    'jobManagement.messageAction': 'رسالة',
    'jobManagement.interestPending': 'قيد الانتظار',
    'jobManagement.interestAccepted': 'مقبول',
    'jobManagement.interestRejected': 'مرفوض',
    'jobManagement.filterNew': 'جديد',
    'jobManagement.filterQuoted': 'عروض مرسلة',
    'jobManagement.filterScheduled': 'مجدول',
    'jobManagement.emptyNewTitle': 'لا توجد فرص جديدة',
    'jobManagement.emptyNewBody': 'ستظهر هنا المنشورات الجديدة القريبة منك.',
    'jobManagement.emptyQuotedTitle': 'لم يتم إرسال أي عرض بعد',
    'jobManagement.emptyQuotedBody': 'ستظهر هنا العروض التي ترسلها على الفرص الجديدة.',
    'jobManagement.emptyScheduledTitle': 'لا توجد أعمال مجدولة',
    'jobManagement.emptyScheduledBody': 'ستظهر هنا الأعمال التي حجزتها.',

    // Profile — invite friends badge (missing-key audit)
    'profile.inviteBadge': 'جديد',

    // Jobs view — operational hub (CARD-24: Today/Upcoming/Needs action/Past)
    'jobManagement.filterToday': 'اليوم',
    'jobManagement.filterUpcoming': 'القادمة',
    'jobManagement.filterNeedsAction': 'يتطلب إجراء',
    'jobManagement.filterPast': 'السابقة',
    'jobManagement.emptyTodayTitle': 'لا يوجد شيء مجدول اليوم',
    'jobManagement.emptyTodayBody': 'ستظهر هنا الأعمال المؤكدة لهذا اليوم.',
    'jobManagement.emptyUpcomingTitle': 'لا توجد أعمال قادمة',
    'jobManagement.emptyUpcomingBody': 'ستظهر هنا الأعمال المؤكدة لوقت لاحق.',
    'jobManagement.emptyNeedsActionTitle': 'كل شيء على ما يرام',
    'jobManagement.emptyNeedsActionBody': 'ستظهر هنا الفرص الجديدة والعروض والحجوزات التي تحتاج إلى إجرائك.',
    'jobManagement.emptyPastTitle': 'لا توجد أعمال سابقة',
    'jobManagement.emptyPastBody': 'ستظهر هنا الأعمال المكتملة والملغاة، كل منها مرتبط بفاتورته.',
    'jobManagement.needsActionNewLeads': 'طلبات جديدة',
    'jobManagement.needsActionBookings': 'حجوزات تحتاج إجراء',
    'jobManagement.needsActionQuotesSent': 'عروض بانتظار الرد',
    'jobManagement.needsActionUnassigned': 'تحتاج إلى تعيين موظف',
    'jobManagement.needsActionProposeDate': 'اقترح موعدًا',
    'jobManagement.needsActionAwaitingDate': 'بانتظار تأكيد الموعد',
    'jobManagement.viewInvoice': 'عرض الفاتورة',

    // Dashboard — next job / money in flight (CARD-24)
    'dashboard.nextJobTitle': 'العمل التالي',
    'dashboard.nextJobNone': 'لا توجد أعمال قادمة مجدولة',
    'dashboard.moneyInFlightTitle': 'الأموال قيد المعالجة',
    'dashboard.moneyHeld': 'محتجزة في الضمان',
    'dashboard.moneyCleared': 'تم تحريرها',
    'dashboard.heroCaption': 'حُوِّلت إليك',
    'dashboard.moneyUnavailable': 'تعذر تحميل إجماليات الدفع',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'افتح قفل Swingbyy',
    'biometric.lockedBody': 'استخدم بصمة الوجه أو بصمة الإصبع لمتابعة الدخول.',
    'biometric.unlockCta': 'فتح القفل',
    'biometric.declinedHint': 'لم ينجح؟ حاول مرة أخرى أو سجّل الدخول بطريقة مختلفة.',
    'biometric.useDifferentAccount': 'تسجيل الدخول بطريقة مختلفة',
    'biometric.prompt': 'افتح قفل Swingbyy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'فتح القفل ببصمة الوجه / الإصبع',
    'settings.biometricUnavailableHint': 'غير مُعدّ على هذا الجهاز',
    'settings.biometricUnavailableTitle': 'غير متاح',
    'settings.biometricUnavailableBody': 'بصمة الوجه أو الإصبع غير معدة على هذا الجهاز بعد. فعّلها من إعدادات جهازك ثم حاول مرة أخرى.',
    'settings.biometricConfirmPrompt': 'أكّد لتفعيل فتح القفل البيومتري',
    // Rebook — one-tap repeat booking from a completed job (CARD-12)
    'rebook.button': 'إعادة الحجز',
    'rebook.bannerTitle': 'إعادة حجز %{business}',
    'rebook.descriptionTemplate': 'إعادة حجز %{business} — نفس العمل السابق. أضف أي تفاصيل جديدة أدناه.',

    // Favorites — save a business for later (CARD-12)
    'favorites.add': 'حفظ في المفضلة',
    'favorites.remove': 'إزالة من المفضلة',
    'favorites.added': 'تم الحفظ في المفضلة',
    'favorites.removed': 'تمت الإزالة من المفضلة',
    // CARD-20 (D2) — booking-entry flow: disappearing chat banner + the
    // floating booking badge that replaced the old plain "Booking"/"Quote"
    // label in the Messages list.
    'chat.disappearingBanner': 'اتفقوا على موعد لتحويل هذه المحادثة إلى محادثة الحجز.',
    'messages.badgeQuote': 'عرض سعر',
    'messages.badgeBooking': 'حجز',
    'messages.badgeBookingPending': 'بانتظار الموعد',
    'messages.badgeBookingA11y': 'فتح تفاصيل الحجز',
    // ── Lane 2 · الرسائل وعروض الأسعار (5a / 3a) ───────────────────────────
    'messages.title': 'الرسائل',
    'messages.quotesTitle': 'عروض الأسعار',
    'messages.sentQuotesTitle': 'العروض المرسلة',
    'messages.quotesSubtitleClient': '%{n} مفتوحة · لم تُحجز بعد',
    'messages.quotesSubtitleBusiness': '%{n} مرسلة · %{amount} قيد الانتظار',
    'messages.bookedSection': 'الأعمال المحجوزة',
    'messages.searchPlaceholder': 'ابحث في المحادثات',
    'messages.bubbleQuotes': 'العروض',
    'messages.bubbleSent': 'العروض المرسلة',
    'messages.bubbleBack': 'العودة للمحادثات',
    'messages.now': 'الآن',
    'messages.chatFallback': 'محادثة',
    'messages.clientFallback': 'عميل',
    'messages.businessFallback': 'شركة',
    'messages.jobFallback': 'طلب خدمة',
    'messages.noMessagesYet': 'لا توجد رسائل بعد',
    'messages.metaToday': 'اليوم · %{time}',
    'messages.metaUpcoming': 'قادم · %{date}',
    'messages.metaCompleted': 'مكتمل',
    'messages.metaCompletedOn': 'مكتمل · %{date}',
    'messages.metaInProgress': 'قيد التنفيذ',
    'messages.metaAwaitingTime': 'بانتظار الموعد',
    'messages.quoteAwaitingYou': 'بانتظار ردك',
    'messages.quoteExpiresIn': 'ينتهي خلال %{left}',
    'messages.quoteExpiresInDays': 'ينتهي خلال %{n} يوم',
    'messages.quoteAwaitingReply': 'بانتظار الرد',
    'messages.quoteAwaitingReplyLeft': 'بانتظار الرد · تبقى %{left}',
    'messages.quoteAwaitingTheirs': 'بانتظار عرضهم',
    'messages.quoteRequested': 'طُلب %{when}',
    'messages.quoteDeclined': 'مرفوض',
    'messages.quoteYouDeclined': 'رفضته',
    'messages.quoteExpired': 'منتهٍ',
    'messages.quotesFooterClient': 'العروض المقبولة تنتقل إلى الرسائل كأعمال محجوزة.',
    'messages.quotesFooterBusiness': 'العروض المقبولة تظهر في الأعمال — عندها فقط.',
    'messages.emptyChatsTitle': 'لا توجد أعمال محجوزة بعد',
    'messages.emptyChatsBody': 'تُفتح المحادثة هنا بمجرد قبول العرض ودفعه.',
    'messages.emptyQuotesTitle': 'لا توجد عروض مفتوحة',
    'messages.emptyQuotesBodyClient': 'العروض التي تصلك تبقى هنا حتى تقبل واحدًا.',
    'messages.emptyQuotesBodyBusiness': 'العروض التي ترسلها تبقى هنا حتى يرد العميل.',
    'messages.emptySearchTitle': 'لا نتائج',
    'messages.emptySearchBody': 'لا توجد أعمال محجوزة تطابق "%{query}".',
    'messages.errorTitle': 'تعذّر تحميل صندوق الرسائل',
    'messages.loadError': 'تحقق من اتصالك وحاول مرة أخرى.',
    'chat.quoteNotBooked': 'عرض سعر · لم يُحجز بعد',
    'quoteCard.eyebrow': 'عرض سعر',
    'quoteCard.eyebrowSent': 'عرض مُرسل',
    'quoteCard.service': 'الخدمة',
    'quoteCard.when': 'الموعد',
    'quoteCard.expires': 'ينتهي',
    'quoteCard.statusLabel': 'الحالة',
    'quoteCard.awaitingReply': 'بانتظار الرد · تبقى %{left}',
    'quoteCard.expired': 'منتهٍ',
    'quoteCard.inMinutes': 'خلال %{n} دقيقة',
    'quoteCard.inHours': 'خلال %{n} ساعة',
    'quoteCard.inDays': 'خلال %{n} يوم',
    'quoteCard.payNote': 'تدفع الآن — سترى الإجمالي قبل التأكيد.',
    'quoteCard.decline': 'رفض',
    'quoteCard.acceptAndPay': 'قبول والدفع',
    'quoteCard.declineError': 'تعذّر رفض هذا العرض',
    'quoteCard.withdraw': 'سحب',
    'quoteCard.editQuote': 'تعديل العرض',
    'quoteCard.sentLocked': 'تعديل عرض مُرسل غير متاح بعد — راسل العميل بدلاً من ذلك.',
    'quoteCard.acceptedTitle': 'مقبول · تم دفع %{amount}',
    'quoteCard.acceptedWhen': 'أصبح حجزًا · %{when}',
    'quoteCard.acceptedNow': 'أصبح حجزًا',
    'quoteCard.view': 'عرض',
    'quoteCard.expiredTitle': 'انتهى العرض · %{amount}',
    'quoteCard.expiredBody': 'اطلب عرضًا جديدًا',
    'quoteCard.reRequest': 'إعادة الطلب',
    'quoteCard.declinedTitle': 'عرض مرفوض · %{amount}',
    'quoteCard.declinedBody': 'يمكنك متابعة المحادثة',
    'jobManagement.sentQuotesMoved': 'العروض المرسلة موجودة في الرسائل خلف فقاعة العروض. يظهر العمل هنا عند القبول.',
  },
};

// ─── Lane 3 (payments + flow-breakers) ───────────────────────────────────────
// APPENDED, never merged into the blocks above — several lanes append to this
// file in parallel and a hunk in the middle of `translations` conflicts with
// all of them. English only: i18n.enableFallback is on below, so fr-CA and ar
// resolve these through the en fallback until they are translated.
const lane3 = {
  // Pay sheet — design/handoff-jet-pulse/PAYMENTS.md
  'pay.titleHold': 'Hold payment',
  'pay.titlePay': 'Pay quote',
  'pay.ctaHold': 'Confirm & hold',
  'pay.ctaPay': 'Confirm & pay',
  'pay.holding': 'Holding payment…',
  'pay.paying': 'Taking payment…',
  'pay.jobTotal': 'Job total',
  'pay.quote': 'Quote',
  'pay.serviceFee': 'Service fee',
  'pay.onHoldToday': 'On hold today',
  'pay.total': 'Total',
  'pay.payWith': 'Pay with',
  'pay.change': 'Change',
  'pay.expires': 'Expires %{date}',
  'pay.savedCard': 'Saved card',
  'pay.methodCard': 'Card',
  // Two different promises, deliberately. 'native' = Stripe's Payment Sheet
  // opens right here (M9). 'Sub' (hosted Checkout fallback) has to warn that a
  // browser is about to open, or the client thinks the app broke.
  'pay.methodCardSub': 'Opens a secure Stripe page. Saved for next time — Swingbyy never sees your card number.',
  'pay.methodCardSubNative': 'Entered securely via Stripe and saved for next time — Swingbyy never sees your card number.',
  'pay.addMethod': 'Add a payment method',
  'pay.noMethodHint': 'Add a card to continue. Nothing is charged until you confirm.',
  'pay.escrow':
    'Held in escrow — released only when you approve the work. Cancel free up to 48 h before.',
  'pay.declined': 'That card was declined. Try another one.',
  'pay.amountChanged': 'This quote changed — check the new total before you confirm.',
  'pay.quoteError': 'Could not price this job. Try again.',
  'pay.noAmount': 'No amount to charge for this job.',

  // Path A — post a job, pay on post
  'postJob.reviewTitle': 'Review job',
  'postJob.rowService': 'Service',
  'postJob.rowWhen': 'When',
  'postJob.rowWhere': 'Where',
  'postJob.rowBudget': 'Your budget',
  'postJob.rowBusiness': 'Business',
  'postJob.escrowExplainer':
    "when you post, and hold it. Businesses only see paid jobs. Anything you don't spend is refunded when you accept a quote, and all of it is refunded if nobody takes the job.",
  'postJob.escrowExplainerLead': 'We charge your budget',
  'postJob.ctaPostAndPay': 'Post job & pay',
  'postJob.ctaSendRequest': 'Send request',
  'postJob.holdFailed': 'Payment was not taken, so the job was not posted. Your draft is safe.',
  'postJob.addressLabel': "Address (where's the job?)",
  'postJob.addressHint': "We use this to show the job to pros nearby. It stays hidden until you accept a quote.",
  'postJob.addressRequired': 'Add the address so nearby pros can find the job.',

  // Path A success
  'postJob.postedTitle': 'Job posted',
  'postJob.postedBodyHeld': 'was charged and held in escrow. Anything unused is refunded when you accept a quote.',
  'postJob.postedBodyNoHold': 'Nearby pros are being notified now.',
  'postJob.postedRowHold': 'Payment charged',
  'postJob.postedRowHoldSub': 'Unused budget is refunded when you accept a quote',
  'postJob.postedRowQuotes': 'Expect quotes within',
  'postJob.postedRowQuotesValue': '~2 h',
  'postJob.viewJob': 'View job',

  // Path B — accept a quote
  'quotes.acceptAndPay': 'Accept & pay',
  'quotes.payFirstNote': "You'll see the total before you confirm. Nothing is charged until then.",
  'quotes.accepted': 'Quote accepted',

  // Request sent — PROOF-REQUEST-WEB-AUTOBID.md §2
  'requestSent.title': 'Request sent',
  'requestSent.subReply': '%{business} usually replies in about %{time}.',
  'requestSent.subFallback': '%{business} usually replies within a few hours.',
  'requestSent.subFallbackGeneric': 'Pros nearby usually reply within a few hours.',
  'requestSent.step1Title': 'They send a quote',
  'requestSent.step1Body': 'It lands behind the Quotes bubble in Messages.',
  'requestSent.step2Title': 'You chat and agree',
  'requestSent.step2Body': 'Ask anything before you commit.',
  'requestSent.step3Title': 'Accept & pay',
  'requestSent.step3Body': 'Only then is it booked.',
  'requestSent.noPaymentLead': 'No payment yet.',
  'requestSent.noPaymentBody': 'Nothing is charged until you accept.',
  'requestSent.openConversation': 'Open the conversation',
  'requestSent.trackRequest': 'Track this request',
  'requestSent.morePros': 'Request from more pros',

  // Booking details — B15 / B16 / D5
  'booking.liveStatus': 'Live status',
  'booking.liveStatusEmpty': 'Updates appear here as the pro works.',
  'booking.liveStatusError': 'Could not load live status.',
  'booking.eventDatesProposed': 'Times proposed',
  'booking.eventDateConfirmed': 'Date confirmed',
  'booking.eventEnRoute': 'On the way',
  'booking.eventArrived': 'Pro arrived',
  'booking.eventStarted': 'Job started',
  'booking.eventPaused': 'Job paused',
  'booking.eventResumed': 'Job resumed',
  'booking.eventCompleted': 'Job complete',
  'booking.eventPaymentReleased': 'Payment released',
  'booking.eventCancelled': 'Cancelled',
  'booking.eventGeneric': 'Booking updated',
  'booking.timeSetAtPosting': 'Time set at posting: %{when}',
  'booking.moreActions': 'More',
  'booking.moreActionsA11y': 'More booking actions',
  'booking.reportProblem': 'Report a problem',
  'booking.cancelBooking': 'Cancel booking',
  'booking.viewReceipt': 'View receipt',
  'booking.reviewRelease': 'Review work & release payment',
  'booking.markPaidOffPlatform': 'Mark as paid (cash / e-transfer)',
  'booking.payNow': 'Pay now',
  'booking.message': 'Message',
};
Object.assign(translations.en, lane3);

// ─── Accept charges now (founder ruling 2026-07-25) ──────────────────────────
// Appended as its own block for the same reason as lane3 above: parallel lanes
// edit this file and a hunk in the middle of `translations` conflicts with all
// of them. English only — enableFallback is on.
const acceptChargesNow = {
  // Path B outcomes — accepting a quote now charges in-app, immediately.
  'quotes.paidAndBooked': 'Paid — it’s booked',
  'quotes.finishInBrowser': 'Finish the payment in your browser to confirm it.',
  // The sheet was dismissed. The booking is real and unpaid, and saying so is
  // the whole point — the one thing we never do is leave it there quietly.
  'quotes.notPaidYet': 'Not paid yet',
  'quotes.notPaidYetBody':
    'Your booking is held but unpaid. Pay it to confirm — the pro isn’t scheduled until you do.',
  'quotes.payFailed': 'Could not take the payment. Your booking is held but unpaid.',
  'quotes.noQuote': 'No quote selected.',
  'quotes.noBooking': 'That quote could not be turned into a booking. Nothing was charged.',
};
Object.assign(translations.en, acceptChargesNow);

// ── Posting takes no money — 2026-07-29 ──────────────────────────────────────
// Appended for the same merge-conflict reason as the blocks above. English
// only — enableFallback is on.
//
// The block above ("Post + Pay (same button)") described an intention, not the
// build. Nothing is charged when a client posts a job: the charge-at-post
// trigger is gated OFF in backend/app/api/service_posts.py because it cannot
// capture without card-on-file (no matched business, no agreed price, no
// bookings row for payments.booking_id, no saved card), and `payment_started`
// on the create response is therefore always false. Money is collected at
// ACCEPT, through mobile/src/services/acceptAndPay.js.
//
// So every string that told the client their budget was charged or held at
// post time was false — in a payments product. These replace them. The wording
// matches the targeted-quote branch, which was right all along: nothing is
// charged until you accept a quote.
//
// The keys deliberately dropped rather than reworded, so no screen can revive
// the old claim by referencing them: postJob.ctaPostAndPay,
// postJob.ctaPostAndPayAmount, postJob.chargeDeclined, postJob.holdFailed.
const postTakesNoMoney = {
  // Review-step explainer (the lock-icon block).
  'postJob.escrowExplainerLead': 'Nothing is charged now.',
  'postJob.escrowExplainer':
    'Your budget tells pros what you have to work with. You pay only when you accept a quote, and you see the exact price first.',

  // Review-step CTA. No amount: naming a figure on a button is how you say
  // "this charges it", and this one does not.
  'postJob.ctaPost': 'Post job',

  // Review-step hint. Was a hardcoded English template literal in
  // PostJobScreen; it belongs here like its neighbours, since the app ships
  // en / fr-CA / ar.
  'postJob.hintOpen':
    "Pros nearby see your job and send quotes. You're not charged until you accept one.",
  'postJob.hintTargeted':
    '%{business} replies with a price and time. Nothing is charged until you accept.',

  // Pay sheet, mode="hold" — used only by the post-a-job flow. It is a budget
  // review, not a checkout: it takes no money, so it no longer says it does,
  // and PaySheet hides the "Pay with" card picker in this mode.
  'pay.titleHold': 'Confirm your job',
  'pay.ctaHold': 'Post job',
  'pay.holding': 'Posting…',
  'pay.onHoldToday': 'Your budget',
  'pay.escrowHold':
    'Nothing is charged now. You pay when you accept a quote, and unused budget is never taken.',

  // Public business profile, third stat in the mock's row. Real completed
  // bookings only — see _completed_bookings in backend/app/api/businesses.py.
  'businessProfile.jobsDone': '%{count} jobs done',
};
Object.assign(translations.en, postTakesNoMoney);
for (const key of [
  'postJob.ctaPostAndPay',
  'postJob.ctaPostAndPayAmount',
  'postJob.chargeDeclined',
  'postJob.holdFailed',
]) {
  delete translations.en[key];
}

// ── The restart prompt when layout direction flips — 2026-07-30 ─────────────
// Translated into ALL THREE locales rather than English-with-fallback, unlike
// most of the recent append blocks. This particular dialog is shown at the
// exact moment somebody switches INTO or OUT OF Arabic, so an English-only
// string here would greet an Arabic speaker in English at the one moment they
// have just told us they do not want English. It is four strings; there is no
// excuse for deferring them.
Object.assign(translations.en, {
  'language.restartTitle': 'Restart needed',
  'language.restartBody':
    'Swingbyy needs to restart to switch the layout for %{language}.',
  'language.restartNow': 'Restart now',
  'language.restartManual': 'Please close and reopen Swingbyy to finish switching.',
});
Object.assign(translations['fr-CA'], {
  'language.restartTitle': 'Redémarrage nécessaire',
  'language.restartBody':
    'Swingbyy doit redémarrer pour adapter la mise en page à %{language}.',
  'language.restartNow': 'Redémarrer maintenant',
  'language.restartManual':
    'Veuillez fermer puis rouvrir Swingbyy pour terminer le changement.',
});
Object.assign(translations.ar, {
  'language.restartTitle': 'يلزم إعادة التشغيل',
  'language.restartBody':
    'يحتاج Swingbyy إلى إعادة التشغيل لتغيير اتجاه الواجهة إلى %{language}.',
  'language.restartNow': 'إعادة التشغيل الآن',
  'language.restartManual': 'يرجى إغلاق Swingbyy وفتحه مرة أخرى لإكمال التغيير.',
});

// ── Report + block (App Store Guideline 1.2) — 2026-07-31 ───────────────────
// Appended as its own block for the same merge-conflict reason as every block
// above.
//
// Translated into ALL THREE locales rather than English-with-fallback, on the
// same reasoning as the restart prompt: this is the safety flow. Someone
// reaching for "report" or "block" is, by definition, having a bad time on the
// platform, and answering them in a language they did not choose is the worst
// possible moment to fall back. It is also what Guideline 1.2 is actually
// about — a reporting mechanism a user cannot read is not a reporting
// mechanism.
const moderationEn = {
  // Entry points
  'moderation.report': 'Report',
  'moderation.reportMessage': 'Report this message',
  'moderation.reportReview': 'Report this review',
  'moderation.reportPost': 'Report this post',
  'moderation.reportBusiness': 'Report this business',
  'moderation.reportUser': 'Report this person',

  // Report sheet
  'moderation.reportTitle': 'Report',
  'moderation.reportSubtitle': 'Tell us what’s wrong. We review every report.',
  'moderation.reasonLabel': 'What’s the problem?',
  'moderation.reasonHarassment': 'Harassment or bullying',
  'moderation.reasonHateSpeech': 'Hate speech',
  'moderation.reasonSexualContent': 'Sexual content',
  'moderation.reasonViolence': 'Violence or threats',
  'moderation.reasonScam': 'Scam or fraud',
  'moderation.reasonOffPlatform': 'Trying to take the job off Swingbyy',
  'moderation.reasonSpam': 'Spam',
  'moderation.reasonOther': 'Something else',
  'moderation.detailsLabel': 'Anything else? (optional)',
  'moderation.detailsPlaceholder': 'Add anything that would help us understand.',
  'moderation.submitReport': 'Submit report',
  'moderation.submitting': 'Sending…',
  'moderation.reportSent': 'Report sent',
  'moderation.reportSentBody':
    'Thanks — our team reviews every report, usually within 24 hours.',
  'moderation.alreadyReported': 'You’ve already reported this',
  'moderation.alreadyReportedBody': 'It’s in the queue. We’ll take a look.',
  'moderation.reportFailed': 'Could not send that report. Try again.',

  // Blocking
  'moderation.block': 'Block',
  'moderation.unblock': 'Unblock',
  'moderation.blockUser': 'Block this person',
  'moderation.blockConfirmTitle': 'Block %{name}?',
  'moderation.blockConfirmBody':
    'They won’t be able to message you or see your posts, and you won’t see theirs. You can undo this in Settings → Safety.',
  'moderation.blocked': 'Blocked',
  'moderation.blockFailed': 'Could not block that person. Try again.',
  'moderation.unblockConfirmTitle': 'Unblock %{name}?',
  'moderation.unblockConfirmBody': 'You’ll be able to see and message each other again.',

  // Settings → Safety
  'moderation.safety': 'Safety',
  'moderation.blockedAccounts': 'Blocked accounts',
  'moderation.blockedAccountsTitle': 'Blocked accounts',
  'moderation.blockedEmptyTitle': 'No one is blocked',
  'moderation.blockedEmptyBody':
    'Block someone from a chat or their profile and they’ll show up here.',
  'moderation.blockedOn': 'Blocked %{date}',

  // Chat
  'moderation.threadBlockedTitle': 'You can’t reply here',
  'moderation.threadBlockedBody':
    'One of you blocked the other. Unblock in Settings → Safety to start talking again.',
  'moderation.messageRefused':
    'That message can’t be sent. Swingbyy doesn’t allow hate speech, sexual solicitation, or threats.',

  // Admin review queue
  'moderation.queueTitle': 'Reports',
  'moderation.queueEmptyTitle': 'Nothing to review',
  'moderation.queueEmptyBody': 'New reports land here.',
  'moderation.queueReportCount': 'Reported %{count} times',
  'moderation.reviewTitle': 'Review report',
  'moderation.actionNone': 'Dismiss — nothing wrong',
  'moderation.actionHide': 'Hide the content',
  'moderation.actionWarn': 'Warn the user',
  'moderation.actionSuspend': 'Suspend the account',
  'moderation.resolutionLabel': 'Notes (optional)',
  'moderation.resolve': 'Resolve',
  'moderation.resolved': 'Resolved',
  'moderation.resolveFailed': 'Could not resolve that report. Try again.',
};
Object.assign(translations.en, moderationEn);

Object.assign(translations['fr-CA'], {
  'moderation.report': 'Signaler',
  'moderation.reportMessage': 'Signaler ce message',
  'moderation.reportReview': 'Signaler cet avis',
  'moderation.reportPost': 'Signaler cette annonce',
  'moderation.reportBusiness': 'Signaler cette entreprise',
  'moderation.reportUser': 'Signaler cette personne',

  'moderation.reportTitle': 'Signalement',
  'moderation.reportSubtitle':
    'Dites-nous ce qui ne va pas. Nous examinons chaque signalement.',
  'moderation.reasonLabel': 'Quel est le problème?',
  'moderation.reasonHarassment': 'Harcèlement ou intimidation',
  'moderation.reasonHateSpeech': 'Propos haineux',
  'moderation.reasonSexualContent': 'Contenu sexuel',
  'moderation.reasonViolence': 'Violence ou menaces',
  'moderation.reasonScam': 'Arnaque ou fraude',
  'moderation.reasonOffPlatform': 'Tentative de contourner Swingbyy',
  'moderation.reasonSpam': 'Pourriel',
  'moderation.reasonOther': 'Autre chose',
  'moderation.detailsLabel': 'Autre chose? (facultatif)',
  'moderation.detailsPlaceholder': 'Ajoutez ce qui pourrait nous aider à comprendre.',
  'moderation.submitReport': 'Envoyer le signalement',
  'moderation.submitting': 'Envoi…',
  'moderation.reportSent': 'Signalement envoyé',
  'moderation.reportSentBody':
    'Merci — notre équipe examine chaque signalement, généralement en moins de 24 heures.',
  'moderation.alreadyReported': 'Vous avez déjà signalé ceci',
  'moderation.alreadyReportedBody': 'C’est dans la file. Nous allons regarder.',
  'moderation.reportFailed': 'Impossible d’envoyer ce signalement. Réessayez.',

  'moderation.block': 'Bloquer',
  'moderation.unblock': 'Débloquer',
  'moderation.blockUser': 'Bloquer cette personne',
  'moderation.blockConfirmTitle': 'Bloquer %{name}?',
  'moderation.blockConfirmBody':
    'Cette personne ne pourra plus vous écrire ni voir vos annonces, et vous ne verrez plus les siennes. Vous pouvez annuler dans Réglages → Sécurité.',
  'moderation.blocked': 'Bloqué',
  'moderation.blockFailed': 'Impossible de bloquer cette personne. Réessayez.',
  'moderation.unblockConfirmTitle': 'Débloquer %{name}?',
  'moderation.unblockConfirmBody':
    'Vous pourrez de nouveau vous voir et vous écrire.',

  'moderation.safety': 'Sécurité',
  'moderation.blockedAccounts': 'Comptes bloqués',
  'moderation.blockedAccountsTitle': 'Comptes bloqués',
  'moderation.blockedEmptyTitle': 'Personne n’est bloqué',
  'moderation.blockedEmptyBody':
    'Bloquez quelqu’un depuis une conversation ou son profil et il apparaîtra ici.',
  'moderation.blockedOn': 'Bloqué le %{date}',

  'moderation.threadBlockedTitle': 'Vous ne pouvez pas répondre ici',
  'moderation.threadBlockedBody':
    'L’un de vous a bloqué l’autre. Débloquez dans Réglages → Sécurité pour reprendre la conversation.',
  'moderation.messageRefused':
    'Ce message ne peut pas être envoyé. Swingbyy n’autorise ni les propos haineux, ni la sollicitation sexuelle, ni les menaces.',

  'moderation.queueTitle': 'Signalements',
  'moderation.queueEmptyTitle': 'Rien à examiner',
  'moderation.queueEmptyBody': 'Les nouveaux signalements arrivent ici.',
  'moderation.queueReportCount': 'Signalé %{count} fois',
  'moderation.reviewTitle': 'Examiner le signalement',
  'moderation.actionNone': 'Rejeter — rien à signaler',
  'moderation.actionHide': 'Masquer le contenu',
  'moderation.actionWarn': 'Avertir l’utilisateur',
  'moderation.actionSuspend': 'Suspendre le compte',
  'moderation.resolutionLabel': 'Notes (facultatif)',
  'moderation.resolve': 'Régler',
  'moderation.resolved': 'Réglé',
  'moderation.resolveFailed': 'Impossible de régler ce signalement. Réessayez.',
});

Object.assign(translations.ar, {
  'moderation.report': 'إبلاغ',
  'moderation.reportMessage': 'الإبلاغ عن هذه الرسالة',
  'moderation.reportReview': 'الإبلاغ عن هذا التقييم',
  'moderation.reportPost': 'الإبلاغ عن هذا الطلب',
  'moderation.reportBusiness': 'الإبلاغ عن هذه الشركة',
  'moderation.reportUser': 'الإبلاغ عن هذا الشخص',

  'moderation.reportTitle': 'إبلاغ',
  'moderation.reportSubtitle': 'أخبرنا بما حدث. نراجع كل بلاغ.',
  'moderation.reasonLabel': 'ما المشكلة؟',
  'moderation.reasonHarassment': 'مضايقة أو تنمّر',
  'moderation.reasonHateSpeech': 'خطاب كراهية',
  'moderation.reasonSexualContent': 'محتوى جنسي',
  'moderation.reasonViolence': 'عنف أو تهديد',
  'moderation.reasonScam': 'احتيال أو نصب',
  'moderation.reasonOffPlatform': 'محاولة إتمام العمل خارج Swingbyy',
  'moderation.reasonSpam': 'محتوى مزعج',
  'moderation.reasonOther': 'شيء آخر',
  'moderation.detailsLabel': 'أي تفاصيل أخرى؟ (اختياري)',
  'moderation.detailsPlaceholder': 'أضف ما يساعدنا على فهم ما حدث.',
  'moderation.submitReport': 'إرسال البلاغ',
  'moderation.submitting': 'جارٍ الإرسال…',
  'moderation.reportSent': 'تم إرسال البلاغ',
  'moderation.reportSentBody': 'شكرًا — يراجع فريقنا كل بلاغ، عادةً خلال 24 ساعة.',
  'moderation.alreadyReported': 'سبق أن أبلغت عن هذا',
  'moderation.alreadyReportedBody': 'البلاغ في قائمة المراجعة. سنطّلع عليه.',
  'moderation.reportFailed': 'تعذّر إرسال البلاغ. حاول مرة أخرى.',

  'moderation.block': 'حظر',
  'moderation.unblock': 'إلغاء الحظر',
  'moderation.blockUser': 'حظر هذا الشخص',
  'moderation.blockConfirmTitle': 'حظر %{name}؟',
  'moderation.blockConfirmBody':
    'لن يتمكّن من مراسلتك أو رؤية طلباتك، ولن ترى طلباته. يمكنك التراجع من الإعدادات ← الأمان.',
  'moderation.blocked': 'محظور',
  'moderation.blockFailed': 'تعذّر حظر هذا الشخص. حاول مرة أخرى.',
  'moderation.unblockConfirmTitle': 'إلغاء حظر %{name}؟',
  'moderation.unblockConfirmBody': 'ستتمكّنان من رؤية ومراسلة بعضكما مرة أخرى.',

  'moderation.safety': 'الأمان',
  'moderation.blockedAccounts': 'الحسابات المحظورة',
  'moderation.blockedAccountsTitle': 'الحسابات المحظورة',
  'moderation.blockedEmptyTitle': 'لا يوجد أحد محظور',
  'moderation.blockedEmptyBody':
    'احظر شخصًا من محادثة أو من ملفه الشخصي وسيظهر هنا.',
  'moderation.blockedOn': 'حُظر في %{date}',

  'moderation.threadBlockedTitle': 'لا يمكنك الرد هنا',
  'moderation.threadBlockedBody':
    'أحدكما حظر الآخر. ألغِ الحظر من الإعدادات ← الأمان لمتابعة المحادثة.',
  'moderation.messageRefused':
    'تعذّر إرسال هذه الرسالة. لا يسمح Swingbyy بخطاب الكراهية أو الطلبات الجنسية أو التهديدات.',

  'moderation.queueTitle': 'البلاغات',
  'moderation.queueEmptyTitle': 'لا شيء للمراجعة',
  'moderation.queueEmptyBody': 'تظهر البلاغات الجديدة هنا.',
  'moderation.queueReportCount': 'تم الإبلاغ %{count} مرات',
  'moderation.reviewTitle': 'مراجعة البلاغ',
  'moderation.actionNone': 'رفض — لا توجد مخالفة',
  'moderation.actionHide': 'إخفاء المحتوى',
  'moderation.actionWarn': 'تحذير المستخدم',
  'moderation.actionSuspend': 'تعليق الحساب',
  'moderation.resolutionLabel': 'ملاحظات (اختياري)',
  'moderation.resolve': 'إنهاء',
  'moderation.resolved': 'تم',
  'moderation.resolveFailed': 'تعذّر إنهاء هذا البلاغ. حاول مرة أخرى.',
});

// ── Account deletion asks for a password only when there is one — 2026-07-31 ─
// App Store Guideline 5.1.1(v). A Sign in with Apple account has no password,
// so the sheet has two shapes and needs copy for both.
Object.assign(translations.en, {
  'settings.deleteAccountTitle': 'Delete my account',
  'settings.deleteAccountBody':
    'Your profile disappears from Swingbyy and you’re signed out. Bookings, payments and invoices are kept for 6 years — Canadian tax law requires it — but they’re no longer linked to your name.',
  'settings.deleteAccountPasswordLabel': 'Your password',
  'settings.deleteAccountPasswordHint': 'Enter it to confirm this is you.',
  'settings.deleteAccountConfirm': 'Delete account',
  'settings.deleteAccountCancel': 'Keep my account',
  'settings.deleteAccountDeleting': 'Deleting…',
  'settings.deleteAccountWrongPassword': 'That password didn’t match. Try again.',
  'settings.deleteAccountFailed': 'Could not delete your account. Try again.',
  'settings.deleteAccountDone': 'Your account has been deleted.',
});
Object.assign(translations['fr-CA'], {
  'settings.deleteAccountTitle': 'Supprimer mon compte',
  'settings.deleteAccountBody':
    'Votre profil disparaît de Swingbyy et vous êtes déconnecté. Les réservations, paiements et factures sont conservés 6 ans — la loi fiscale canadienne l’exige — mais ils ne sont plus liés à votre nom.',
  'settings.deleteAccountPasswordLabel': 'Votre mot de passe',
  'settings.deleteAccountPasswordHint': 'Saisissez-le pour confirmer que c’est bien vous.',
  'settings.deleteAccountConfirm': 'Supprimer le compte',
  'settings.deleteAccountCancel': 'Garder mon compte',
  'settings.deleteAccountDeleting': 'Suppression…',
  'settings.deleteAccountWrongPassword':
    'Ce mot de passe ne correspond pas. Réessayez.',
  'settings.deleteAccountFailed': 'Impossible de supprimer votre compte. Réessayez.',
  'settings.deleteAccountDone': 'Votre compte a été supprimé.',
});
Object.assign(translations.ar, {
  'settings.deleteAccountTitle': 'حذف حسابي',
  'settings.deleteAccountBody':
    'سيختفي ملفك الشخصي من Swingbyy وسيتم تسجيل خروجك. تُحفظ الحجوزات والمدفوعات والفواتير لمدة 6 سنوات — كما يقتضي القانون الضريبي الكندي — لكنها لن تكون مرتبطة باسمك.',
  'settings.deleteAccountPasswordLabel': 'كلمة المرور',
  'settings.deleteAccountPasswordHint': 'أدخلها لتأكيد هويتك.',
  'settings.deleteAccountConfirm': 'حذف الحساب',
  'settings.deleteAccountCancel': 'الاحتفاظ بحسابي',
  'settings.deleteAccountDeleting': 'جارٍ الحذف…',
  'settings.deleteAccountWrongPassword': 'كلمة المرور غير صحيحة. حاول مرة أخرى.',
  'settings.deleteAccountFailed': 'تعذّر حذف حسابك. حاول مرة أخرى.',
  'settings.deleteAccountDone': 'تم حذف حسابك.',
});

// ── The client's approval is what releases the money — 2026-07-31 ───────────
// Until now the BUSINESS released its own escrow by marking the job complete,
// so the client had nothing to approve and none of this copy existed. All three
// locales, not English-with-fallback: this is the screen where somebody parts
// with money, and a fallback language at that moment is not acceptable.
Object.assign(translations.en, {
  'approval.approveCta': 'Approve & release payment',
  'approval.approveShort': 'Approve',
  'approval.confirmTitle': 'Release the payment?',
  'approval.confirmBody':
    'This pays the pro for the work. Only do this if the job is finished and you’re happy with it.',
  'approval.confirmBodyAmount':
    'This releases %{amount} to the pro. Only do this if the job is finished and you’re happy with it.',
  'approval.released': 'Payment released',
  'approval.failed': 'Could not release the payment',
  // The waiting state, shown to whoever is waiting.
  'approval.waitingTitle': 'Waiting for you to approve',
  'approval.waitingBody':
    'The pro marked this job done. Check the work, then release the payment. If you do nothing it releases automatically in 24 hours.',
  'approval.businessWaitingTitle': 'Waiting for the client',
  'approval.businessWaitingBody':
    'You marked this done. The client has 24 hours to approve — after that the payment releases to you automatically.',
  'approval.autoReleased': 'Released automatically — the client didn’t respond in 24 hours.',
});

// ── Proof of work — walkthrough bugs 3/7/8, 2026-08-08 ──────────────────────
// Submitting proof and marking a job complete are two separate actions. Three
// spots on the business side used to describe the wrong one of them: the
// submit toast promised the client could approve immediately, the "Mark
// complete" confirmation said it "may release final payment" (it holds it and
// opens a 24h window instead — see approval.businessWaitingBody above, which
// is what actually happens next), and the Progress tab gave no sign proof had
// been sent at all. EN only for now — these aren't in the money-copy set above,
// which shipped all locales because it is the screen where funds move.
Object.assign(translations.en, {
  'proof.submitToast.title': 'Proof saved',
  'proof.submitToast.body': 'Mark the job complete to send it to the client for approval.',
  'proof.progress.submittedTitle': 'Proof sent',
  'proof.progress.submittedSubtitle': 'Awaiting the client’s approval',
  'proof.progress.submittedBadge': 'Awaiting approval',
  'proof.progress.approvedTitle': 'Proof approved',
  'proof.progress.approvedSubtitle': 'The client approved this work',
  'proof.progress.approvedBadge': 'Approved',
  'jobStages.confirmComplete':
    'Mark the job complete? This holds payment and starts the client’s 24-hour approval window.',
});
Object.assign(translations['fr-CA'], {
  'approval.approveCta': 'Approuver et libérer le paiement',
  'approval.approveShort': 'Approuver',
  'approval.confirmTitle': 'Libérer le paiement?',
  'approval.confirmBody':
    'Ceci paie le pro pour son travail. À faire seulement si le travail est terminé et vous convient.',
  'approval.confirmBodyAmount':
    'Ceci libère %{amount} au pro. À faire seulement si le travail est terminé et vous convient.',
  'approval.released': 'Paiement libéré',
  'approval.failed': 'Impossible de libérer le paiement',
  'approval.waitingTitle': 'En attente de votre approbation',
  'approval.waitingBody':
    'Le pro a marqué ce travail comme terminé. Vérifiez le travail, puis libérez le paiement. Sans action de votre part, il sera libéré automatiquement dans 24 heures.',
  'approval.businessWaitingTitle': 'En attente du client',
  'approval.businessWaitingBody':
    'Vous avez marqué ce travail comme terminé. Le client a 24 heures pour approuver — ensuite le paiement vous est libéré automatiquement.',
  'approval.autoReleased':
    'Libéré automatiquement — le client n’a pas répondu en 24 heures.',
});
Object.assign(translations.ar, {
  'approval.approveCta': 'الموافقة وتحرير الدفعة',
  'approval.approveShort': 'موافقة',
  'approval.confirmTitle': 'تحرير الدفعة؟',
  'approval.confirmBody':
    'سيتم دفع المبلغ للمحترف مقابل عمله. لا تفعل ذلك إلا إذا اكتمل العمل وكنت راضيًا عنه.',
  'approval.confirmBodyAmount':
    'سيتم تحرير %{amount} للمحترف. لا تفعل ذلك إلا إذا اكتمل العمل وكنت راضيًا عنه.',
  'approval.released': 'تم تحرير الدفعة',
  'approval.failed': 'تعذّر تحرير الدفعة',
  'approval.waitingTitle': 'بانتظار موافقتك',
  'approval.waitingBody':
    'أشار المحترف إلى اكتمال العمل. تحقّق من العمل ثم حرّر الدفعة. إذا لم تقم بأي إجراء، ستُحرَّر تلقائيًا خلال 24 ساعة.',
  'approval.businessWaitingTitle': 'بانتظار العميل',
  'approval.businessWaitingBody':
    'لقد أشرت إلى اكتمال العمل. أمام العميل 24 ساعة للموافقة — بعدها تُحرَّر الدفعة إليك تلقائيًا.',
  'approval.autoReleased': 'تم التحرير تلقائيًا — لم يستجب العميل خلال 24 ساعة.',
});

// ── The role pick a social sign-in never offered — 2026-07-31 ───────────────
// A trade signing in with Apple on a shared iPad landed in the CLIENT app with
// no way out. All three locales: this is the first screen a new account sees,
// and answering it wrong is expensive to undo.
Object.assign(translations.en, {
  'rolePicker.title': 'How will you use Swingbyy?',
  'rolePicker.body': 'Pick one — you can only choose this once.',
  'rolePicker.clientTitle': "I'm hiring",
  'rolePicker.clientBody': 'Post jobs and book local pros.',
  'rolePicker.businessTitle': "I'm offering services",
  'rolePicker.businessBody': 'Send quotes and get booked.',
  'rolePicker.footnote':
    'Signing in with Apple or Google skips the signup form, so we have to ask here.',
  'rolePicker.failed': "Couldn't save that. Try again.",
  // Terms + privacy consent at signup (App Store + PIPEDA).
  // agreePrefix reads as a checkbox LABEL ("I agree to…") because the box is an
  // affirmative act we record; agreeNotice is the passive line on the login
  // screen, where social sign-in can still mint a brand-new account.
  'auth.agreePrefix': 'I agree to the',
  'auth.agreeTerms': 'Terms of Service',
  'auth.agreeAnd': 'and the',
  'auth.agreePrivacy': 'Privacy Policy',
  'auth.agreeRequired': 'Please accept the Terms and Privacy Policy to continue.',
  'auth.agreeNotice': 'By continuing you agree to our',
});
Object.assign(translations['fr-CA'], {
  'rolePicker.title': 'Comment allez-vous utiliser Swingbyy?',
  'rolePicker.body': 'Choisissez — ce choix ne se fait qu’une fois.',
  'rolePicker.clientTitle': 'Je cherche un pro',
  'rolePicker.clientBody': 'Publiez des travaux et réservez des pros locaux.',
  'rolePicker.businessTitle': "J'offre des services",
  'rolePicker.businessBody': 'Envoyez des devis et soyez réservé.',
  'rolePicker.footnote':
    'La connexion avec Apple ou Google saute le formulaire d’inscription; nous devons donc le demander ici.',
  'rolePicker.failed': 'Impossible d’enregistrer. Réessayez.',
  'auth.agreePrefix': 'J’accepte les',
  'auth.agreeTerms': 'Conditions d’utilisation',
  'auth.agreeAnd': 'et la',
  'auth.agreePrivacy': 'Politique de confidentialité',
  'auth.agreeRequired':
    'Veuillez accepter les Conditions et la Politique de confidentialité pour continuer.',
  'auth.agreeNotice': 'En continuant, vous acceptez nos',
});
Object.assign(translations.ar, {
  'rolePicker.title': 'كيف ستستخدم Swingbyy؟',
  'rolePicker.body': 'اختر — يمكنك الاختيار مرة واحدة فقط.',
  'rolePicker.clientTitle': 'أبحث عن محترف',
  'rolePicker.clientBody': 'انشر طلبات العمل واحجز محترفين قريبين.',
  'rolePicker.businessTitle': 'أقدّم خدمات',
  'rolePicker.businessBody': 'أرسل عروض أسعار واحصل على حجوزات.',
  'rolePicker.footnote':
    'تسجيل الدخول عبر Apple أو Google يتخطى نموذج التسجيل، لذا نسأل هنا.',
  'rolePicker.failed': 'تعذّر الحفظ. حاول مرة أخرى.',
  'auth.agreePrefix': 'أوافق على',
  'auth.agreeTerms': 'شروط الخدمة',
  'auth.agreeAnd': 'و',
  'auth.agreePrivacy': 'سياسة الخصوصية',
  'auth.agreeRequired': 'يرجى قبول الشروط وسياسة الخصوصية للمتابعة.',
  'auth.agreeNotice': 'بالمتابعة فإنك توافق على',
});

// ── P3: two timestamps, neither labelled ───────────────────────────────────
// "Time confirmed · 10:01 PM · Time set at posting: Sat, Jul 25 at 3:54 PM" —
// one of those is the appointment and one is when the update was logged, and
// the row said neither. They are on separate lines now, and this labels the
// one that was easiest to mistake for the appointment.
Object.assign(translations.en, { 'booking.eventLoggedAt': 'Logged %{time}' });
Object.assign(translations['fr-CA'], { 'booking.eventLoggedAt': 'Enregistré à %{time}' });
Object.assign(translations.ar, { 'booking.eventLoggedAt': 'سُجِّل %{time}' });

// ── Ghost mode + credits: two features that existed with no way in ─────────
// POST /me/ghost, POST /me/unghost and GET /me/credits all shipped weeks ago
// and were called by nothing. Ghost mode is PROMISED IN WRITING in
// PrivacyPolicyScreen §3, and a credit is money we owe someone a business let
// down. Both are in Settings now.
Object.assign(translations.en, {
  'settings.ghostMode': 'Ghost mode',
  'settings.ghostModeHint':
    'Hide your profile and posts from discovery. Existing bookings and chats keep working, and signing in again turns it off.',
  'settings.ghostOn': "You're hidden",
  'settings.ghostOff': "You're visible again",
  'settings.ghostFailed': "Couldn't change ghost mode",
  'settings.credit': 'Swingbyy credit',
  'settings.creditHint': 'Contact us when you book and we\u2019ll apply it.',
});
Object.assign(translations['fr-CA'], {
  'settings.ghostMode': 'Mode fant\u00f4me',
  'settings.ghostModeHint':
    'Masquez votre profil et vos annonces. Les r\u00e9servations et discussions en cours continuent, et une nouvelle connexion le d\u00e9sactive.',
  'settings.ghostOn': 'Vous \u00eates masqu\u00e9',
  'settings.ghostOff': 'Vous \u00eates de nouveau visible',
  'settings.ghostFailed': 'Impossible de changer le mode fant\u00f4me',
  'settings.credit': 'Cr\u00e9dit Swingbyy',
  'settings.creditHint': 'Contactez-nous lors de votre r\u00e9servation et nous l\u2019appliquerons.',
});
Object.assign(translations.ar, {
  'settings.ghostMode': '\u0648\u0636\u0639 \u0627\u0644\u0625\u062e\u0641\u0627\u0621',
  'settings.ghostModeHint':
    '\u0623\u062e\u0641\u0650 \u0645\u0644\u0641\u0643 \u0648\u0625\u0639\u0644\u0627\u0646\u0627\u062a\u0643 \u0645\u0646 \u0627\u0644\u0628\u062d\u062b. \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a \u0648\u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u062a\u0633\u062a\u0645\u0631\u060c \u0648\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u062c\u062f\u062f\u064b\u0627 \u064a\u0648\u0642\u0641\u0647.',
  'settings.ghostOn': '\u0623\u0646\u062a \u0645\u062e\u0641\u064a \u0627\u0644\u0622\u0646',
  'settings.ghostOff': '\u0623\u0635\u0628\u062d\u062a \u0645\u0631\u0626\u064a\u064b\u0627 \u0645\u062c\u062f\u062f\u064b\u0627',
  'settings.ghostFailed': '\u062a\u0639\u0630\u0651\u0631 \u062a\u063a\u064a\u064a\u0631 \u0648\u0636\u0639 \u0627\u0644\u0625\u062e\u0641\u0627\u0621',
  'settings.credit': '\u0631\u0635\u064a\u062f Swingbyy',
  'settings.creditHint': '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627 \u0639\u0646\u062f \u0627\u0644\u062d\u062c\u0632 \u0648\u0633\u0646\u0637\u0628\u0651\u0642\u0647.',
});

// ── lane3 payment/booking copy, finally translated — 2026-08-01 ────────────
// These 98 keys shipped English-only. Fallback meant a French or Arabic user
// got English mid-sentence on the PAY SHEET and the post-a-job flow — the two
// screens where money is explained. The picker offered a language the product
// did not actually speak at the moment it mattered most.
//
// `pay.escrow` also said "cancel free up to 24 h" while the real ladder is 48 h
// (escrow.classify_cancellation_timing, mirrored in CancellationFlowScreen and
// the Terms). A client cancelling 25 h out, trusting that line, was charged a
// 25% fee they had been told did not apply. Fixed in the English above before
// being translated, so the mistake was not copied into two more languages.
//
// Interpolations (%{business}, %{when}, %{count}, %{date}, %{time}) are kept
// verbatim — i18n-js matches them literally and a translated placeholder
// renders as raw text.
Object.assign(translations['fr-CA'], {
  'pay.titleHold': 'Confirmez votre demande',
  'pay.titlePay': 'Payer le devis',
  'pay.ctaHold': 'Publier la demande',
  'pay.ctaPay': 'Confirmer et payer',
  'pay.holding': 'Publication…',
  'pay.paying': 'Paiement en cours…',
  'pay.jobTotal': 'Total du travail',
  'pay.quote': 'Devis',
  'pay.serviceFee': 'Frais de service',
  'pay.onHoldToday': 'Votre budget',
  'pay.total': 'Total',
  'pay.payWith': 'Payer avec',
  'pay.change': 'Modifier',
  'pay.expires': 'Expire le %{date}',
  'pay.savedCard': 'Carte enregistrée',
  'pay.methodCard': 'Carte',
  'pay.methodCardSub':
    'Ouvre une page Stripe sécurisée. Carte conservée pour la prochaine fois — Swingbyy ne voit jamais son numéro.',
  'pay.methodCardSubNative':
    'Saisie de façon sécurisée via Stripe et conservée pour la prochaine fois — Swingbyy ne voit jamais son numéro.',
  'pay.addMethod': 'Ajouter un moyen de paiement',
  'pay.noMethodHint':
    'Ajoutez une carte pour continuer. Rien n’est débité avant votre confirmation.',
  'pay.escrow':
    'Retenu en fiducie — libéré seulement quand vous approuvez le travail. Annulation gratuite jusqu’à 48 h avant.',
  'pay.declined': 'Carte refusée. Essayez-en une autre.',
  'pay.amountChanged':
    'Ce devis a changé — vérifiez le nouveau total avant de confirmer.',
  'pay.quoteError': 'Impossible de calculer le prix. Réessayez.',
  'pay.noAmount': 'Aucun montant à facturer pour ce travail.',
  'pay.escrowHold':
    'Rien n’est débité maintenant. Vous payez en acceptant un devis, et le budget inutilisé n’est jamais prélevé.',
  'postJob.reviewTitle': 'Vérifier la demande',
  'postJob.rowService': 'Service',
  'postJob.rowWhen': 'Quand',
  'postJob.rowWhere': 'Où',
  'postJob.rowBudget': 'Votre budget',
  'postJob.rowBusiness': 'Entreprise',
  'postJob.escrowExplainer':
    'Votre budget indique aux pros ce dont vous disposez. Vous payez seulement en acceptant un devis, et vous voyez le prix exact d’abord.',
  'postJob.escrowExplainerLead': 'Rien n’est débité maintenant.',
  'postJob.ctaSendRequest': 'Envoyer la demande',
  'postJob.ctaPost': 'Publier la demande',
  'postJob.hintOpen':
    'Les pros à proximité voient votre demande et envoient des devis. Rien n’est débité avant que vous en acceptiez un.',
  'postJob.hintTargeted':
    '%{business} répond avec un prix et une heure. Rien n’est débité avant votre acceptation.',
  'postJob.addressLabel': 'Adresse (où se déroule le travail?)',
  'postJob.addressHint':
    'Nous l’utilisons pour montrer le travail aux pros à proximité. Elle reste cachée jusqu’à ce que vous acceptiez un devis.',
  'postJob.addressRequired':
    'Ajoutez l’adresse pour que les pros à proximité trouvent le travail.',
  'postJob.postedTitle': 'Demande publiée',
  'postJob.postedBodyHeld':
    'a été débité et retenu en fiducie. Tout montant inutilisé est remboursé quand vous acceptez un devis.',
  'postJob.postedBodyNoHold': 'Les pros à proximité sont avisés maintenant.',
  'postJob.postedRowHold': 'Paiement débité',
  'postJob.postedRowHoldSub':
    'Le budget inutilisé est remboursé quand vous acceptez un devis',
  'postJob.postedRowQuotes': 'Devis attendus d’ici',
  'postJob.postedRowQuotesValue': '~2 h',
  'postJob.viewJob': 'Voir la demande',
  'quotes.acceptAndPay': 'Accepter et payer',
  'quotes.payFirstNote':
    'Vous verrez le total avant de confirmer. Rien n’est débité avant.',
  'quotes.accepted': 'Devis accepté',
  'quotes.paidAndBooked': 'Payé — c’est réservé',
  'quotes.finishInBrowser':
    'Terminez le paiement dans votre navigateur pour le confirmer.',
  'quotes.notPaidYet': 'Pas encore payé',
  'quotes.notPaidYetBody':
    'Votre réservation est retenue mais non payée. Payez pour la confirmer — le pro n’est pas planifié avant.',
  'quotes.payFailed':
    'Impossible de prendre le paiement. Votre réservation est retenue mais non payée.',
  'quotes.noQuote': 'Aucun devis sélectionné.',
  'quotes.noBooking':
    'Ce devis n’a pas pu être converti en réservation. Rien n’a été débité.',
  'requestSent.title': 'Demande envoyée',
  'requestSent.subReply':
    '%{business} répond habituellement en environ %{time}.',
  'requestSent.subFallback':
    '%{business} répond habituellement en quelques heures.',
  'requestSent.subFallbackGeneric':
    'Les pros à proximité répondent habituellement en quelques heures.',
  'requestSent.step1Title': 'Ils envoient un devis',
  'requestSent.step1Body': 'Il apparaît derrière la bulle Devis dans Messages.',
  'requestSent.step2Title': 'Vous discutez et vous vous entendez',
  'requestSent.step2Body': 'Posez vos questions avant de vous engager.',
  'requestSent.step3Title': 'Accepter et payer',
  'requestSent.step3Body': 'C’est seulement là que c’est réservé.',
  'requestSent.noPaymentLead': 'Aucun paiement pour l’instant.',
  'requestSent.noPaymentBody': 'Rien n’est débité avant votre acceptation.',
  'requestSent.openConversation': 'Ouvrir la conversation',
  'requestSent.trackRequest': 'Suivre cette demande',
  'requestSent.morePros': 'Demander à d’autres pros',
  'booking.liveStatus': 'Statut en direct',
  'booking.liveStatusEmpty':
    'Les mises à jour apparaissent ici pendant le travail du pro.',
  'booking.liveStatusError': 'Impossible de charger le statut en direct.',
  'booking.eventDatesProposed': 'Horaires proposés',
  'booking.eventDateConfirmed': 'Date confirmée',
  'booking.eventEnRoute': 'En route',
  'booking.eventArrived': 'Le pro est arrivé',
  'booking.eventStarted': 'Travail commencé',
  'booking.eventPaused': 'Travail en pause',
  'booking.eventResumed': 'Travail repris',
  'booking.eventCompleted': 'Travail terminé',
  'booking.eventCancelled': 'Annulé',
  'booking.eventGeneric': 'Réservation mise à jour',
  'booking.timeSetAtPosting': 'Heure fixée à la publication : %{when}',
  'booking.moreActions': 'Plus',
  'booking.moreActionsA11y': 'Plus d’actions de réservation',
  'booking.reportProblem': 'Signaler un problème',
  'booking.cancelBooking': 'Annuler la réservation',
  'booking.viewReceipt': 'Voir le reçu',
  'booking.reviewRelease': 'Vérifier le travail et libérer le paiement',
  'booking.markPaidOffPlatform': 'Marquer comme payé (comptant / virement)',
  'booking.payNow': 'Payer maintenant',
  'booking.message': 'Message',
  'businessProfile.jobsDone': '%{count} travaux réalisés',
});
Object.assign(translations.ar, {
  'pay.titleHold': 'أكّد طلبك',
  'pay.titlePay': 'دفع العرض',
  'pay.ctaHold': 'انشر الطلب',
  'pay.ctaPay': 'تأكيد ودفع',
  'pay.holding': 'جارٍ النشر…',
  'pay.paying': 'جارٍ تنفيذ الدفع…',
  'pay.jobTotal': 'إجمالي العمل',
  'pay.quote': 'عرض السعر',
  'pay.serviceFee': 'رسوم الخدمة',
  'pay.onHoldToday': 'ميزانيتك',
  'pay.total': 'الإجمالي',
  'pay.payWith': 'الدفع بواسطة',
  'pay.change': 'تغيير',
  'pay.expires': 'ينتهي في %{date}',
  'pay.savedCard': 'بطاقة محفوظة',
  'pay.methodCard': 'بطاقة',
  'pay.methodCardSub': 'يفتح صفحة Stripe آمنة. تُحفظ بطاقتك للمرة القادمة — ولا ترى Swingbyy رقم بطاقتك أبدًا.',
  'pay.methodCardSubNative': 'تُدخَل بأمان عبر Stripe وتُحفظ للمرة القادمة — ولا ترى Swingbyy رقم بطاقتك أبدًا.',
  'pay.addMethod': 'أضف طريقة دفع',
  'pay.noMethodHint': 'أضف بطاقة للمتابعة. لن يُخصم أي مبلغ حتى تؤكّد.',
  'pay.escrow':
    'محتجز في الضمان — يُحرَّر فقط عند موافقتك على العمل. إلغاء مجاني حتى 48 ساعة قبل الموعد.',
  'pay.declined': 'تم رفض هذه البطاقة. جرّب بطاقة أخرى.',
  'pay.amountChanged': 'تغيّر هذا العرض — راجع الإجمالي الجديد قبل التأكيد.',
  'pay.quoteError': 'تعذّر تسعير هذا العمل. حاول مرة أخرى.',
  'pay.noAmount': 'لا يوجد مبلغ لتحصيله لهذا العمل.',
  'pay.escrowHold':
    'لن يُخصم أي مبلغ الآن. تدفع عند قبولك عرضًا، ولا يُؤخذ المبلغ غير المستخدم أبدًا.',
  'postJob.reviewTitle': 'مراجعة الطلب',
  'postJob.rowService': 'الخدمة',
  'postJob.rowWhen': 'الموعد',
  'postJob.rowWhere': 'المكان',
  'postJob.rowBudget': 'ميزانيتك',
  'postJob.rowBusiness': 'المحترف',
  'postJob.escrowExplainer':
    'ميزانيتك تُعلم المحترفين بالمبلغ المتاح لديك. تدفع فقط عند قبولك عرضًا، وترى السعر الدقيق أولًا.',
  'postJob.escrowExplainerLead': 'لن يُخصم أي مبلغ الآن.',
  'postJob.ctaSendRequest': 'أرسل الطلب',
  'postJob.ctaPost': 'انشر الطلب',
  'postJob.hintOpen':
    'يرى المحترفون القريبون طلبك ويرسلون عروض أسعار. لا يُخصم منك شيء حتى تقبل أحدها.',
  'postJob.hintTargeted':
    'سيردّ %{business} بالسعر والموعد. لن يُخصم أي مبلغ حتى تقبل.',
  'postJob.addressLabel': 'العنوان (أين العمل؟)',
  'postJob.addressHint':
    'نستخدمه لعرض العمل على المحترفين القريبين. يبقى مخفيًا حتى تقبل عرضًا.',
  'postJob.addressRequired':
    'أضف العنوان ليتمكن المحترفون القريبون من العثور على العمل.',
  'postJob.postedTitle': 'تم نشر الطلب',
  'postJob.postedBodyHeld':
    'تم خصمه واحتجازه في الضمان. يُعاد أي مبلغ غير مستخدم عند قبولك عرضًا.',
  'postJob.postedBodyNoHold': 'يجري الآن إشعار المحترفين القريبين.',
  'postJob.postedRowHold': 'تم تحصيل الدفعة',
  'postJob.postedRowHoldSub': 'يُعاد المبلغ غير المستخدم عند قبولك عرضًا',
  'postJob.postedRowQuotes': 'توقّع العروض خلال',
  'postJob.postedRowQuotesValue': '~ساعتان',
  'postJob.viewJob': 'عرض الطلب',
  'quotes.acceptAndPay': 'اقبل وادفع',
  'quotes.payFirstNote': 'سترى الإجمالي قبل التأكيد. لن يُخصم شيء قبل ذلك.',
  'quotes.accepted': 'تم قبول العرض',
  'quotes.paidAndBooked': 'تم الدفع — الحجز مؤكد',
  'quotes.finishInBrowser': 'أكمل الدفع في المتصفح لتأكيده.',
  'quotes.notPaidYet': 'لم يُدفع بعد',
  'quotes.notPaidYetBody':
    'حجزك محفوظ لكنه غير مدفوع. ادفع لتأكيده — لن يُجدوَل المحترف قبل ذلك.',
  'quotes.payFailed': 'تعذّر تنفيذ الدفع. حجزك محفوظ لكنه غير مدفوع.',
  'quotes.noQuote': 'لم يتم اختيار أي عرض.',
  'quotes.noBooking': 'تعذّر تحويل هذا العرض إلى حجز. لم يُخصم أي مبلغ.',
  'requestSent.title': 'تم إرسال الطلب',
  'requestSent.subReply': 'عادةً ما يردّ %{business} خلال %{time} تقريبًا.',
  'requestSent.subFallback': 'عادةً ما يردّ %{business} خلال بضع ساعات.',
  'requestSent.subFallbackGeneric':
    'عادةً ما يردّ المحترفون القريبون خلال بضع ساعات.',
  'requestSent.step1Title': 'يرسلون عرض سعر',
  'requestSent.step1Body': 'يصل خلف فقاعة العروض في الرسائل.',
  'requestSent.step2Title': 'تتحدثان وتتفقان',
  'requestSent.step2Body': 'اسأل عن أي شيء قبل الالتزام.',
  'requestSent.step3Title': 'اقبل وادفع',
  'requestSent.step3Body': 'عندها فقط يصبح الحجز مؤكدًا.',
  'requestSent.noPaymentLead': 'لا دفع حتى الآن.',
  'requestSent.noPaymentBody': 'لن يُخصم أي مبلغ حتى تقبل.',
  'requestSent.openConversation': 'افتح المحادثة',
  'requestSent.trackRequest': 'تتبّع هذا الطلب',
  'requestSent.morePros': 'اطلب من محترفين آخرين',
  'booking.liveStatus': 'الحالة المباشرة',
  'booking.liveStatusEmpty': 'تظهر التحديثات هنا أثناء عمل المحترف.',
  'booking.liveStatusError': 'تعذّر تحميل الحالة المباشرة.',
  'booking.eventDatesProposed': 'تم اقتراح مواعيد',
  'booking.eventDateConfirmed': 'تم تأكيد الموعد',
  'booking.eventEnRoute': 'في الطريق',
  'booking.eventArrived': 'وصل المحترف',
  'booking.eventStarted': 'بدأ العمل',
  'booking.eventPaused': 'تم إيقاف العمل مؤقتًا',
  'booking.eventResumed': 'استؤنف العمل',
  'booking.eventCompleted': 'اكتمل العمل',
  'booking.eventCancelled': 'أُلغي',
  'booking.eventGeneric': 'تم تحديث الحجز',
  'booking.timeSetAtPosting': 'الموعد المحدد عند النشر: %{when}',
  'booking.moreActions': 'المزيد',
  'booking.moreActionsA11y': 'المزيد من إجراءات الحجز',
  'booking.reportProblem': 'الإبلاغ عن مشكلة',
  'booking.cancelBooking': 'إلغاء الحجز',
  'booking.viewReceipt': 'عرض الإيصال',
  'booking.reviewRelease': 'راجع العمل وحرّر الدفعة',
  'booking.markPaidOffPlatform': 'وضع علامة مدفوع (نقدًا / تحويل إلكتروني)',
  'booking.payNow': 'ادفع الآن',
  'booking.message': 'مراسلة',
  'businessProfile.jobsDone': '%{count} عمل منجز',
});

translations.uk = translations.uk || {};
// ── Ukrainian ──────────────────────────────────────────────────────────────
// Added 2026-08-01, complete on arrival: all 468 keys, no fallback holes.
//
// It was already registered as `planned` with the reasoning attached — the
// 2021 Census predates the 2022 arrivals, and Alberta took the most per
// capita. Shipping it as a partial catalogue would have repeated the mistake
// Arabic just came out of: a language offered in the picker that turns back
// into English on the screens that explain money.
Object.assign(translations.uk, {
  'auth.signin': 'Увійти',
  'auth.signup': 'Створити акаунт',
  'auth.logout': 'Вийти',
  'auth.email': 'Електронна пошта',
  'auth.password': 'Пароль',
  'auth.forgotPassword': 'Забули пароль?',
  'auth.noAccount': 'Немає акаунта?',
  'auth.hasAccount': 'Уже маєте акаунт?',
  'auth.login': 'Увійти',
  'common.save': 'Зберегти',
  'common.cancel': 'Скасувати',
  'common.delete': 'Видалити',
  'common.confirm': 'Підтвердити',
  'common.back': 'Назад',
  'common.loading': 'Завантаження…',
  'common.error': 'Щось пішло не так',
  'common.retry': 'Спробувати ще раз',
  'common.done': 'Готово',
  'common.edit': 'Редагувати',
  'common.share': 'Поділитися',
  'common.copy': 'Копіювати',
  'common.copied': 'Скопійовано',
  'common.comingSoon': 'Незабаром',
  'settings.title': 'Налаштування',
  'settings.language': 'Мова',
  'settings.languageTitle': 'Оберіть мову',
  'settings.notifications': 'Сповіщення',
  'settings.account': 'Акаунт',
  'settings.privacy': 'Конфіденційність і право',
  'settings.support': 'Підтримка',
  'settings.editProfile': 'Редагувати профіль',
  'settings.privacyPolicy': 'Політика конфіденційності',
  'settings.termsOfService': 'Умови користування',
  'settings.exportData': 'Експортувати мої дані',
  'settings.deleteAccount': 'Видалити акаунт',
  'settings.helpFAQ': 'Довідка та FAQ',
  'settings.contactUs': 'Зв’язатися з нами',
  'settings.signOut': 'Вийти',
  'settings.version': 'Версія',
  'profile.title': 'Редагувати профіль',
  'profile.firstName': 'Ім’я',
  'profile.lastName': 'Прізвище',
  'profile.email': 'Пошта',
  'profile.emailLocked': 'Пошта — зверніться до підтримки, щоб змінити',
  'profile.phone': 'Телефон',
  'profile.saveChanges': 'Зберегти зміни',
  'profile.updated': 'Профіль оновлено',
  'profile.updateError': 'Не вдалося зберегти зміни',
  'profile.photoComingSoon': 'Завантаження фото незабаром',
  'onboarding.skip': 'Пропустити',
  'onboarding.getStarted': 'Почати',
  'onboarding.slide1Title': 'Місцеві майстри, коли потрібно',
  'onboarding.slide1Sub': 'Сантехніка, прибирання, газон і більше — з цінами від перевірених місцевих компаній.',
  'onboarding.slide2Title': 'Ви обираєте день, вони пропонують ціну',
  'onboarding.slide2Sub': 'Опублікуйте один раз. Порівняйте пропозиції. Оберіть найкращу.',
  'onboarding.slide3Title': 'Перевірені виконавці щоразу',
  'onboarding.slide3Sub': 'Фотопідтвердження після завершення. Депонування захищає ваш платіж.',
  'referral.title': 'Поділіться Swingbyy — отримайте $10',
  'referral.body': 'Коли ваш друг завершить перше бронювання, ви обидва отримаєте $10 знижки на наступну роботу.',
  'referral.shareText': 'Приєднуйтесь до мене у Swingbyy! Код: %{code} — https://swingbyy.com',
  'referral.shareCTA': 'Поділитися кодом',
  'referral.stats': '%{friends} друзів приєдналося • $%{earned} зароблено',
  'faq.title': 'Довідка та FAQ',
  'faq.q1': 'Як працює Swingbyy?',
  'faq.q2': 'Як приймають пропозиції?',
  'faq.q3': 'Коли відбувається оплата?',
  'faq.q4': 'Що робити, якщо щось пішло не так?',
  'faq.q5': 'Як стати компанією?',
  'faq.q6': 'Як видалити акаунт?',
  'booking.proposedDatesHeading': 'Компанія запропонувала такий час',
  'booking.proposedTimesHeading': 'Запропонований час — торкніться, щоб прийняти',
  'booking.waitingOtherSide': 'Час надіслано — очікуємо підтвердження',
  'booking.proposeTimesHeading': 'Узгодьте час',
  'booking.proposeTimes': 'Запропонувати час',
  'booking.addAnotherTime': 'Додати ще один час',
  'booking.sendProposal': 'Надіслати пропозицію',
  'booking.proposalSentToast': 'Час запропоновано',
  'booking.proposeErrorToast': 'Не вдалося надіслати запропонований час',
  'booking.confirmedFor': 'Підтверджено на %{date}',
  'booking.dateConfirmedToast': 'Дату підтверджено',
  'booking.confirmDateErrorToast': 'Не вдалося підтвердити дату',
  'booking.viewFullDetails': 'Переглянути деталі',
  'booking.detailsAction': 'Деталі',
  'jobCard.photosLabel': 'Фото (%{count})',
  'jobCard.photoAlt': 'Фото роботи %{index} з %{count}',
  'imageViewer.close': 'Закрити',
  'postJob.categoryOther': 'Інше / загальне',
  'search.placeholder': 'Пошук компаній, категорій…',
  'search.recent': 'НЕЩОДАВНІ',
  'search.idleTitle': 'Знайдіть місцевих майстрів',
  'search.idleBody': 'Введіть назву компанії або категорію',
  'search.noMatchesTitle': 'Нічого не знайдено',
  'search.noMatchesBody': 'Немає результатів для «%{query}»',
  'search.clear': 'Очистити пошук',
  'search.errorTitle': 'Помилка мережі',
  'quotes.decline': 'Відхилити',
  'quotes.declined': 'Пропозицію відхилено',
  'quotes.declineError': 'Не вдалося відхилити пропозицію',
  'disputes.title': 'Мої спори',
  'disputes.empty': 'Спорів немає',
  'disputes.emptyBody': 'Ви не подавали й не отримували спорів.',
  'disputes.loadError': 'Не вдалося завантажити спори',
  'disputes.statusOpen': 'Відкритий',
  'disputes.statusUnderReview': 'На розгляді',
  'disputes.statusResolved': 'Вирішено',
  'disputes.statusDismissed': 'Відхилено',
  'disputes.filedByYou': 'Подано вами',
  'disputes.filedAgainstYou': 'Подано проти вас',
  'disputes.viewLink': 'Мої спори',
  'escrow.title': 'Захист платежу',
  'escrow.fundsHeld': 'Кошти на депонуванні',
  'escrow.fullReleased': 'Переказано після завершення',
  'escrow.status.unpaid': 'Очікує оплати',
  'escrow.status.heldBody': 'Переказується одразу після вашого схвалення роботи, або автоматично через 24 години після позначення її виконаною.',
  'escrow.status.offPlatform': 'Оплачено напряму компанії',
  'escrow.status.refunded': 'Кошти повернено',
  'profile.photoUploading': 'Завантаження фото…',
  'profile.photoUpdated': 'Фото оновлено',
  'profile.photoUploadError': 'Не вдалося завантажити фото',
  'profile.photoPermission': 'Дозвольте Swingbyy доступ до фото, щоб встановити зображення профілю.',
  'dispute.photoUploading': 'Завантаження…',
  'dispute.photoUploadError': 'Не вдалося завантажити фото',
  'dispute.photoPermission': 'Дозвольте Swingbyy доступ до фото, щоб додати докази.',
  'dispute.addPhoto': 'Додати фото',
  'dispute.photosOptional': 'Необов’язково — до 3 фото як доказ.',
  'businessProfile.distanceAway': '%{km} км від вас',
  'businessProfile.completenessLabel': 'Заповненість профілю',
  'businessProfile.completenessTipDescription': 'Додайте опис, щоб клієнти вас знаходили.',
  'businessProfile.completenessTipPhotos': 'Додайте фото робіт, щоб викликати довіру.',
  'businessProfile.completenessTipServices': 'Перелічіть послуги, які ви надаєте.',
  'businessProfile.completenessTipRadius': 'Вкажіть радіус обслуговування, щоб клієнти поруч вас знаходили.',
  'jobManagement.title': 'Роботи',
  'jobManagement.errorTitle': 'Не вдалося завантажити ваші роботи',
  'jobManagement.messageAction': 'Написати',
  'jobManagement.interestPending': 'Очікує',
  'jobManagement.interestAccepted': 'Прийнято',
  'jobManagement.interestRejected': 'Відхилено',
  'jobManagement.filterNew': 'Нові',
  'jobManagement.filterQuoted': 'З пропозицією',
  'jobManagement.filterScheduled': 'Заплановані',
  'jobManagement.emptyNewTitle': 'Немає нових заявок',
  'jobManagement.emptyNewBody': 'Нові оголошення поруч із вами з’являтимуться тут.',
  'jobManagement.emptyQuotedTitle': 'Пропозицій ще не надіслано',
  'jobManagement.emptyQuotedBody': 'Надіслані вами пропозиції з’являтимуться тут.',
  'jobManagement.emptyScheduledTitle': 'Немає запланованих робіт',
  'jobManagement.emptyScheduledBody': 'Заброньовані вами роботи з’являтимуться тут.',
  'profile.inviteBadge': 'Нове',
  'jobManagement.filterToday': 'Сьогодні',
  'jobManagement.filterUpcoming': 'Найближчі',
  'jobManagement.filterNeedsAction': 'Потребує дії',
  'jobManagement.filterPast': 'Минулі',
  'jobManagement.emptyTodayTitle': 'На сьогодні нічого не заплановано',
  'jobManagement.emptyTodayBody': 'Роботи, підтверджені на сьогодні, з’являтимуться тут.',
  'jobManagement.emptyUpcomingTitle': 'Немає найближчих робіт',
  'jobManagement.emptyUpcomingBody': 'Роботи, підтверджені на потім, з’являтимуться тут.',
  'jobManagement.emptyNeedsActionTitle': 'Усе опрацьовано',
  'jobManagement.emptyNeedsActionBody': 'Нові заявки, пропозиції та бронювання, які потребують вас, з’являтимуться тут.',
  'jobManagement.emptyPastTitle': 'Минулих робіт поки немає',
  'jobManagement.emptyPastBody': 'Завершені та скасовані роботи з’являтимуться тут, кожна з посиланням на рахунок.',
  'jobManagement.needsActionNewLeads': 'Нові запити',
  'jobManagement.needsActionBookings': 'Бронювання, що потребують вас',
  'jobManagement.needsActionQuotesSent': 'Пропозиції очікують відповіді',
  'jobManagement.needsActionUnassigned': 'Потрібен працівник',
  'jobManagement.needsActionProposeDate': 'Запропонувати час',
  'jobManagement.needsActionAwaitingDate': 'Очікує підтвердження дати',
  'jobManagement.viewInvoice': 'Переглянути рахунок',
  'dashboard.nextJobTitle': 'Наступна робота',
  'dashboard.nextJobNone': 'Немає запланованих робіт',
  'dashboard.moneyInFlightTitle': 'Гроші в русі',
  'dashboard.moneyHeld': 'На депонуванні',
  'dashboard.moneyCleared': 'Переказано',
  'dashboard.heroCaption': 'переказано вам',
  'dashboard.moneyUnavailable': 'Не вдалося завантажити суми платежів',
  'biometric.lockedTitle': 'Розблокувати Swingbyy',
  'biometric.lockedBody': 'Скористайтеся Face ID, Touch ID або відбитком, щоб продовжити.',
  'biometric.unlockCta': 'Розблокувати',
  'biometric.declinedHint': 'Не спрацювало? Спробуйте ще раз або увійдіть інакше.',
  'biometric.useDifferentAccount': 'Увійти інакше',
  'biometric.prompt': 'Розблокувати Swingbyy',
  'settings.biometricUnlock': 'Розблокування Face ID / відбитком',
  'settings.biometricUnavailableHint': 'Не налаштовано на цьому пристрої',
  'settings.biometricUnavailableTitle': 'Недоступно',
  'settings.biometricUnavailableBody': 'Face ID / відбиток ще не налаштовано на цьому пристрої. Увімкніть його в налаштуваннях пристрою та спробуйте знову.',
  'settings.biometricConfirmPrompt': 'Підтвердьте, щоб увімкнути біометричне розблокування',
  'rebook.button': 'Забронювати знову',
  'rebook.bannerTitle': 'Повторне бронювання: %{business}',
  'rebook.descriptionTemplate': 'Повторне бронювання %{business} — та сама робота, що й минулого разу. Додайте нові деталі нижче.',
  'favorites.add': 'Зберегти в обране',
  'favorites.remove': 'Прибрати з обраного',
  'favorites.added': 'Збережено в обране',
  'favorites.removed': 'Прибрано з обраного',
  'chat.disappearingBanner': 'Узгодьте час, щоб перетворити це на чат бронювання.',
  'messages.badgeQuote': 'Пропозиція',
  'messages.badgeBooking': 'Бронювання',
  'messages.badgeBookingPending': 'Час не узгоджено',
  'messages.badgeBookingA11y': 'Відкрити деталі бронювання',
  'messages.title': 'Повідомлення',
  'messages.quotesTitle': 'Пропозиції',
  'messages.sentQuotesTitle': 'Надіслані пропозиції',
  'messages.quotesSubtitleClient': '%{n} відкритих · ще не заброньовано',
  'messages.quotesSubtitleBusiness': '%{n} надіслано · %{amount} в очікуванні',
  'messages.bookedSection': 'Заброньовані роботи',
  'messages.searchPlaceholder': 'Пошук розмов',
  'messages.bubbleQuotes': 'Пропозиції',
  'messages.bubbleSent': 'Надіслані пропозиції',
  'messages.bubbleBack': 'Назад до чатів',
  'messages.now': 'зараз',
  'messages.chatFallback': 'Чат',
  'messages.clientFallback': 'Клієнт',
  'messages.businessFallback': 'Компанія',
  'messages.jobFallback': 'Оголошення',
  'messages.noMessagesYet': 'Повідомлень ще немає',
  'messages.metaToday': 'Сьогодні · %{time}',
  'messages.metaUpcoming': 'Незабаром · %{date}',
  'messages.metaCompleted': 'Завершено',
  'messages.metaCompletedOn': 'Завершено · %{date}',
  'messages.metaInProgress': 'У процесі',
  'messages.metaAwaitingTime': 'Очікує часу',
  'messages.quoteAwaitingYou': 'Очікує вашої відповіді',
  'messages.quoteExpiresIn': 'Спливає через %{left}',
  'messages.quoteExpiresInDays': 'Спливає через %{n} дн.',
  'messages.quoteAwaitingReply': 'Очікує відповіді',
  'messages.quoteAwaitingReplyLeft': 'Очікує відповіді · залишилось %{left}',
  'messages.quoteAwaitingTheirs': 'Очікує їхньої пропозиції',
  'messages.quoteRequested': 'Запитано %{when}',
  'messages.quoteDeclined': 'Відхилено',
  'messages.quoteYouDeclined': 'Ви відхилили',
  'messages.quoteExpired': 'Термін минув',
  'messages.quotesFooterClient': 'Прийняті пропозиції переходять у Повідомлення як заброньовані роботи.',
  'messages.quotesFooterBusiness': 'Прийняті пропозиції з’являються в Роботах — і лише тоді.',
  'messages.emptyChatsTitle': 'Заброньованих робіт ще немає',
  'messages.emptyChatsBody': 'Чат відкриється тут, щойно пропозицію приймуть і оплатять.',
  'messages.emptyQuotesTitle': 'Немає відкритих пропозицій',
  'messages.emptyQuotesBodyClient': 'Отримані пропозиції збиратимуться тут, доки ви не приймете одну.',
  'messages.emptyQuotesBodyBusiness': 'Надіслані пропозиції збиратимуться тут, доки клієнт не відповість.',
  'messages.emptySearchTitle': 'Немає результатів',
  'messages.emptySearchBody': 'Немає заброньованих робіт за запитом «%{query}».',
  'messages.errorTitle': 'Не вдалося завантажити вхідні',
  'messages.loadError': 'Перевірте з’єднання та спробуйте ще раз.',
  'chat.quoteNotBooked': 'Пропозиція · ще не заброньовано',
  'quoteCard.eyebrow': 'Пропозиція',
  'quoteCard.eyebrowSent': 'Пропозицію надіслано',
  'quoteCard.service': 'Послуга',
  'quoteCard.when': 'Коли',
  'quoteCard.expires': 'Спливає',
  'quoteCard.statusLabel': 'Статус',
  'quoteCard.awaitingReply': 'Очікує відповіді · залишилось %{left}',
  'quoteCard.expired': 'термін минув',
  'quoteCard.inMinutes': 'через %{n} хв',
  'quoteCard.inHours': 'через %{n} год',
  'quoteCard.inDays': 'через %{n} дн.',
  'quoteCard.payNote': 'Ви платите зараз — суму побачите до підтвердження.',
  'quoteCard.decline': 'Відхилити',
  'quoteCard.acceptAndPay': 'Прийняти й оплатити',
  'quoteCard.declineError': 'Не вдалося відхилити цю пропозицію',
  'quoteCard.withdraw': 'Відкликати',
  'quoteCard.editQuote': 'Редагувати пропозицію',
  'quoteCard.sentLocked': 'Змінити надіслану пропозицію поки не можна — напишіть клієнту.',
  'quoteCard.acceptedTitle': 'Прийнято · сплачено %{amount}',
  'quoteCard.acceptedWhen': 'Тепер це бронювання · %{when}',
  'quoteCard.acceptedNow': 'Тепер це бронювання',
  'quoteCard.view': 'Переглянути',
  'quoteCard.expiredTitle': 'Термін пропозиції минув · %{amount}',
  'quoteCard.expiredBody': 'Попросіть нову',
  'quoteCard.reRequest': 'Запитати знову',
  'quoteCard.declinedTitle': 'Пропозицію відхилено · %{amount}',
  'quoteCard.declinedBody': 'Ви можете продовжити спілкування',
  'jobManagement.sentQuotesMoved': 'Надіслані пропозиції — у Повідомленнях, за бульбашкою «Пропозиції». Робота потрапляє сюди після прийняття.',
  'pay.titleHold': 'Підтвердьте роботу',
  'pay.titlePay': 'Оплата пропозиції',
  'pay.ctaHold': 'Опублікувати',
  'pay.ctaPay': 'Підтвердити й оплатити',
  'pay.holding': 'Публікація…',
  'pay.paying': 'Виконуємо оплату…',
  'pay.jobTotal': 'Загалом за роботу',
  'pay.quote': 'Пропозиція',
  'pay.serviceFee': 'Сервісний збір',
  'pay.onHoldToday': 'Ваш бюджет',
  'pay.total': 'Разом',
  'pay.payWith': 'Оплатити через',
  'pay.change': 'Змінити',
  'pay.expires': 'Спливає %{date}',
  'pay.savedCard': 'Збережена картка',
  'pay.methodCard': 'Картка',
  'pay.methodCardSub': 'Відкриє захищену сторінку Stripe. Картку збережено на наступний раз — Swingbyy ніколи не бачить її номер.',
  'pay.methodCardSubNative': 'Вводиться безпечно через Stripe і зберігається на наступний раз — Swingbyy ніколи не бачить її номер.',
  'pay.addMethod': 'Додати спосіб оплати',
  'pay.noMethodHint': 'Додайте картку, щоб продовжити. Нічого не спишеться, доки ви не підтвердите.',
  'pay.escrow': 'На депонуванні — переказується лише після того, як ви схвалите роботу. Безкоштовне скасування за 48 год.',
  'pay.declined': 'Картку відхилено. Спробуйте іншу.',
  'pay.amountChanged': 'Ця пропозиція змінилася — перевірте нову суму перед підтвердженням.',
  'pay.quoteError': 'Не вдалося розрахувати вартість. Спробуйте ще раз.',
  'pay.noAmount': 'Немає суми до оплати за цю роботу.',
  'postJob.reviewTitle': 'Перевірте заявку',
  'postJob.rowService': 'Послуга',
  'postJob.rowWhen': 'Коли',
  'postJob.rowWhere': 'Де',
  'postJob.rowBudget': 'Ваш бюджет',
  'postJob.rowBusiness': 'Компанія',
  'postJob.escrowExplainer': 'Ваш бюджет показує майстрам, на що ви розраховуєте. Ви платите лише коли приймаєте пропозицію, і спершу бачите точну ціну.',
  'postJob.escrowExplainerLead': 'Зараз нічого не списується.',
  'postJob.ctaSendRequest': 'Надіслати запит',
  'postJob.addressLabel': 'Адреса (де виконувати роботу?)',
  'postJob.addressHint': 'Ми використовуємо її, щоб показати роботу майстрам поруч. Вона прихована, доки ви не приймете пропозицію.',
  'postJob.addressRequired': 'Додайте адресу, щоб майстри поруч знайшли роботу.',
  'postJob.postedTitle': 'Заявку опубліковано',
  'postJob.postedBodyHeld': 'списано й розміщено на депонуванні. Невикористане повертається, коли ви приймаєте пропозицію.',
  'postJob.postedBodyNoHold': 'Майстрів поруч уже повідомляють.',
  'postJob.postedRowHold': 'Платіж списано',
  'postJob.postedRowHoldSub': 'Невикористаний бюджет повертається, коли ви приймаєте пропозицію',
  'postJob.postedRowQuotes': 'Очікуйте пропозицій протягом',
  'postJob.postedRowQuotesValue': '~2 год',
  'postJob.viewJob': 'Переглянути заявку',
  'quotes.acceptAndPay': 'Прийняти й оплатити',
  'quotes.payFirstNote': 'Ви побачите суму до підтвердження. До того нічого не списується.',
  'quotes.accepted': 'Пропозицію прийнято',
  'requestSent.title': 'Запит надіслано',
  'requestSent.subReply': '%{business} зазвичай відповідає приблизно за %{time}.',
  'requestSent.subFallback': '%{business} зазвичай відповідає протягом кількох годин.',
  'requestSent.subFallbackGeneric': 'Майстри поруч зазвичай відповідають протягом кількох годин.',
  'requestSent.step1Title': 'Вони надсилають пропозицію',
  'requestSent.step1Body': 'Вона з’явиться за бульбашкою «Пропозиції» у Повідомленнях.',
  'requestSent.step2Title': 'Ви спілкуєтесь і домовляєтесь',
  'requestSent.step2Body': 'Питайте про що завгодно, перш ніж вирішувати.',
  'requestSent.step3Title': 'Прийняти й оплатити',
  'requestSent.step3Body': 'Лише тоді бронювання підтверджено.',
  'requestSent.noPaymentLead': 'Оплати поки немає.',
  'requestSent.noPaymentBody': 'Нічого не списується, доки ви не приймете.',
  'requestSent.openConversation': 'Відкрити розмову',
  'requestSent.trackRequest': 'Відстежити запит',
  'requestSent.morePros': 'Запитати в інших майстрів',
  'booking.liveStatus': 'Статус наживо',
  'booking.liveStatusEmpty': 'Оновлення з’являтимуться тут під час роботи майстра.',
  'booking.liveStatusError': 'Не вдалося завантажити статус.',
  'booking.eventDatesProposed': 'Час запропоновано',
  'booking.eventDateConfirmed': 'Дату підтверджено',
  'booking.eventEnRoute': 'У дорозі',
  'booking.eventArrived': 'Майстер прибув',
  'booking.eventStarted': 'Роботу розпочато',
  'booking.eventPaused': 'Роботу призупинено',
  'booking.eventResumed': 'Роботу відновлено',
  'booking.eventCompleted': 'Роботу завершено',
  'booking.eventCancelled': 'Скасовано',
  'booking.eventGeneric': 'Бронювання оновлено',
  'booking.timeSetAtPosting': 'Час, указаний при публікації: %{when}',
  'booking.moreActions': 'Більше',
  'booking.moreActionsA11y': 'Більше дій із бронюванням',
  'booking.reportProblem': 'Повідомити про проблему',
  'booking.cancelBooking': 'Скасувати бронювання',
  'booking.viewReceipt': 'Переглянути чек',
  'booking.reviewRelease': 'Перевірити роботу та переказати оплату',
  'booking.markPaidOffPlatform': 'Позначити як оплачено (готівка / переказ)',
  'booking.payNow': 'Оплатити зараз',
  'booking.message': 'Написати',
  'quotes.paidAndBooked': 'Оплачено — заброньовано',
  'quotes.finishInBrowser': 'Завершіть оплату у браузері, щоб підтвердити її.',
  'quotes.notPaidYet': 'Ще не оплачено',
  'quotes.notPaidYetBody': 'Ваше бронювання утримується, але не оплачене. Оплатіть, щоб підтвердити — майстра не буде заплановано, доки ви цього не зробите.',
  'quotes.payFailed': 'Не вдалося виконати оплату. Бронювання утримується, але не оплачене.',
  'quotes.noQuote': 'Пропозицію не вибрано.',
  'quotes.noBooking': 'Цю пропозицію не вдалося перетворити на бронювання. Нічого не списано.',
  'postJob.ctaPost': 'Опублікувати',
  'postJob.hintOpen': 'Майстри поруч побачать вашу заявку й надішлють пропозиції. Списання відбудеться лише після того, як ви приймете одну.',
  'postJob.hintTargeted': '%{business} відповість ціною та часом. Нічого не списується, доки ви не приймете.',
  'pay.escrowHold': 'Зараз нічого не списується. Ви платите, коли приймаєте пропозицію, а невикористаний бюджет ніколи не стягується.',
  'businessProfile.jobsDone': '%{count} виконаних робіт',
  'language.restartTitle': 'Потрібен перезапуск',
  'language.restartBody': 'Swingbyy потрібно перезапустити, щоб змінити напрям інтерфейсу для мови %{language}.',
  'language.restartNow': 'Перезапустити зараз',
  'language.restartManual': 'Закрийте та відкрийте Swingbyy, щоб завершити перемикання.',
  'moderation.report': 'Поскаржитись',
  'moderation.reportMessage': 'Поскаржитись на це повідомлення',
  'moderation.reportReview': 'Поскаржитись на цей відгук',
  'moderation.reportPost': 'Поскаржитись на це оголошення',
  'moderation.reportBusiness': 'Поскаржитись на цю компанію',
  'moderation.reportUser': 'Поскаржитись на цю людину',
  'moderation.reportTitle': 'Скарга',
  'moderation.reportSubtitle': 'Розкажіть, що не так. Ми розглядаємо кожну скаргу.',
  'moderation.reasonLabel': 'У чому проблема?',
  'moderation.reasonHarassment': 'Переслідування або цькування',
  'moderation.reasonHateSpeech': 'Мова ворожнечі',
  'moderation.reasonSexualContent': 'Сексуальний вміст',
  'moderation.reasonViolence': 'Насильство або погрози',
  'moderation.reasonScam': 'Шахрайство або обман',
  'moderation.reasonOffPlatform': 'Спроба вивести роботу за межі Swingbyy',
  'moderation.reasonSpam': 'Спам',
  'moderation.reasonOther': 'Щось інше',
  'moderation.detailsLabel': 'Щось іще? (необов’язково)',
  'moderation.detailsPlaceholder': 'Додайте все, що допоможе нам зрозуміти.',
  'moderation.submitReport': 'Надіслати скаргу',
  'moderation.submitting': 'Надсилання…',
  'moderation.reportSent': 'Скаргу надіслано',
  'moderation.reportSentBody': 'Дякуємо — наша команда розглядає кожну скаргу, зазвичай протягом 24 годин.',
  'moderation.alreadyReported': 'Ви вже поскаржилися на це',
  'moderation.alreadyReportedBody': 'Скарга в черзі. Ми розглянемо її.',
  'moderation.reportFailed': 'Не вдалося надіслати скаргу. Спробуйте ще раз.',
  'moderation.block': 'Заблокувати',
  'moderation.unblock': 'Розблокувати',
  'moderation.blockUser': 'Заблокувати цю людину',
  'moderation.blockConfirmTitle': 'Заблокувати %{name}?',
  'moderation.blockConfirmBody': 'Вони не зможуть писати вам чи бачити ваші оголошення, а ви не бачитимете їхніх. Скасувати можна в Налаштування → Безпека.',
  'moderation.blocked': 'Заблоковано',
  'moderation.blockFailed': 'Не вдалося заблокувати цю людину. Спробуйте ще раз.',
  'moderation.unblockConfirmTitle': 'Розблокувати %{name}?',
  'moderation.unblockConfirmBody': 'Ви знову зможете бачити одне одного й листуватися.',
  'moderation.safety': 'Безпека',
  'moderation.blockedAccounts': 'Заблоковані акаунти',
  'moderation.blockedAccountsTitle': 'Заблоковані акаунти',
  'moderation.blockedEmptyTitle': 'Нікого не заблоковано',
  'moderation.blockedEmptyBody': 'Заблокуйте когось із чату або профілю — і вони з’являться тут.',
  'moderation.blockedOn': 'Заблоковано %{date}',
  'moderation.threadBlockedTitle': 'Тут не можна відповідати',
  'moderation.threadBlockedBody': 'Хтось із вас заблокував іншого. Розблокуйте в Налаштування → Безпека, щоб продовжити спілкування.',
  'moderation.messageRefused': 'Це повідомлення не можна надіслати. Swingbyy не допускає мови ворожнечі, сексуальних домагань і погроз.',
  'moderation.queueTitle': 'Скарги',
  'moderation.queueEmptyTitle': 'Немає що розглядати',
  'moderation.queueEmptyBody': 'Нові скарги з’являтимуться тут.',
  'moderation.queueReportCount': 'Поскаржилися %{count} разів',
  'moderation.reviewTitle': 'Розгляд скарги',
  'moderation.actionNone': 'Відхилити — порушень немає',
  'moderation.actionHide': 'Приховати вміст',
  'moderation.actionWarn': 'Попередити користувача',
  'moderation.actionSuspend': 'Призупинити акаунт',
  'moderation.resolutionLabel': 'Нотатки (необов’язково)',
  'moderation.resolve': 'Вирішити',
  'moderation.resolved': 'Вирішено',
  'moderation.resolveFailed': 'Не вдалося вирішити цю скаргу. Спробуйте ще раз.',
  'settings.deleteAccountTitle': 'Видалити акаунт',
  'settings.deleteAccountBody': 'Ваш профіль зникне зі Swingbyy, і вас буде виведено з системи. Бронювання, платежі та рахунки зберігаються 6 років — цього вимагає податкове законодавство Канади — але вони більше не пов’язані з вашим іменем.',
  'settings.deleteAccountPasswordLabel': 'Ваш пароль',
  'settings.deleteAccountPasswordHint': 'Введіть його, щоб підтвердити, що це ви.',
  'settings.deleteAccountConfirm': 'Видалити акаунт',
  'settings.deleteAccountCancel': 'Залишити акаунт',
  'settings.deleteAccountDeleting': 'Видалення…',
  'settings.deleteAccountWrongPassword': 'Пароль не збігається. Спробуйте ще раз.',
  'settings.deleteAccountFailed': 'Не вдалося видалити акаунт. Спробуйте ще раз.',
  'settings.deleteAccountDone': 'Ваш акаунт видалено.',
  'approval.approveCta': 'Схвалити й переказати оплату',
  'approval.approveShort': 'Схвалити',
  'approval.confirmTitle': 'Переказати оплату?',
  'approval.confirmBody': 'Це оплатить майстрові роботу. Робіть це, лише якщо роботу завершено і ви задоволені.',
  'approval.confirmBodyAmount': 'Це переказує %{amount} майстрові. Робіть це, лише якщо роботу завершено і ви задоволені.',
  'approval.released': 'Оплату переказано',
  'approval.failed': 'Не вдалося переказати оплату',
  'approval.waitingTitle': 'Очікує вашого схвалення',
  'approval.waitingBody': 'Майстер позначив роботу як завершену. Перевірте її та переказуйте оплату. Якщо ви нічого не зробите, оплата переказується автоматично через 24 години.',
  'approval.businessWaitingTitle': 'Очікує клієнта',
  'approval.businessWaitingBody': 'Ви позначили роботу завершеною. У клієнта є 24 години на схвалення — після цього оплата переказується вам автоматично.',
  'approval.autoReleased': 'Переказано автоматично — клієнт не відповів протягом 24 годин.',
  'rolePicker.title': 'Як ви користуватиметеся Swingbyy?',
  'rolePicker.body': 'Оберіть одне — вибір робиться лише раз.',
  'rolePicker.clientTitle': 'Я шукаю майстра',
  'rolePicker.clientBody': 'Публікуйте заявки та бронюйте місцевих майстрів.',
  'rolePicker.businessTitle': 'Я надаю послуги',
  'rolePicker.businessBody': 'Надсилайте пропозиції та отримуйте бронювання.',
  'rolePicker.footnote': 'Вхід через Apple або Google пропускає форму реєстрації, тому ми питаємо тут.',
  'rolePicker.failed': 'Не вдалося зберегти. Спробуйте ще раз.',
  'auth.agreePrefix': 'Я погоджуюся з',
  'auth.agreeTerms': 'Умовами користування',
  'auth.agreeAnd': 'і',
  'auth.agreePrivacy': 'Політикою конфіденційності',
  'auth.agreeRequired': 'Прийміть Умови та Політику конфіденційності, щоб продовжити.',
  'auth.agreeNotice': 'Продовжуючи, ви погоджуєтеся з',
  'booking.eventLoggedAt': 'Записано %{time}',
  'settings.ghostMode': 'Режим невидимості',
  'settings.ghostModeHint': 'Приховати ваш профіль і оголошення з пошуку. Наявні бронювання та чати продовжують працювати, а повторний вхід вимикає режим.',
  'settings.ghostOn': 'Вас приховано',
  'settings.ghostOff': 'Вас знову видно',
  'settings.ghostFailed': 'Не вдалося змінити режим невидимості',
  'settings.credit': 'Кредит Swingbyy',
  'settings.creditHint': 'Напишіть нам під час бронювання — і ми його зарахуємо.',
});

// ── Beta invite card (2026-08-03) ────────────────────────────────────────────
// The screen a recruited tester lands on from swingby://invite?code=<CODE>.
//
// TWO STRINGS FROM THE 2026-06-17 SPEC ARE DELIBERATELY NOT HERE:
//   * "Invite expires in 7 days" — no invite expiry exists anywhere in the
//     backend (grep: no invite/referral expiry column, job or check). Printing a
//     deadline we do not enforce is the same class of error as the 50/50 payment
//     claim that had to be pulled from the store listing.
//   * "SwingBy Inc." — there is no such company. The legal entity is `4alkubati`
//     (Kira, 2026-08-03). A copyright line naming a non-existent corporation is a
//     false legal statement on the first screen a stranger sees.
const inviteEn = {
  'invite.badge': 'BETA',
  'invite.hero': 'You’re invited to shape Swingbyy',
  'invite.inviter': 'The Swingbyy Team',
  'invite.inviterRole': 'invited you to join the beta',
  'invite.subhead': 'Be among the first to experience Calgary’s new service marketplace.',
  'invite.body1':
    'Swingbyy connects people who need services with skilled local businesses — from home repairs to personal training, all in one place.',
  'invite.body2':
    'As a beta tester, your feedback directly shapes the app. Share what works, what doesn’t, and what you wish existed.',
  'invite.codeLabel': 'Your invite code',
  'invite.copy': 'Copy code',
  'invite.copied': 'Code copied',
  'invite.copyFailed': 'Could not copy the code',
  'invite.cta': 'Join the beta',
  'invite.haveAccount': 'Already have an account?',
  'invite.signIn': 'Sign in',
  'invite.finePrint': 'This invite is personal to you. Please don’t share it.',
  'invite.copyright': '© 2026 Swingbyy',
  'invite.noCodeTitle': 'This invite link is incomplete',
  'invite.noCodeBody':
    'The link didn’t carry an invite code. Open the original link again, or sign up without one — you can add a code later.',
  'invite.continueAnyway': 'Continue without a code',
};
Object.assign(translations.en, inviteEn);

Object.assign(translations['fr-CA'], {
  'invite.badge': 'BÊTA',
  'invite.hero': 'Vous êtes invité à façonner Swingbyy',
  'invite.inviter': 'L’équipe Swingbyy',
  'invite.inviterRole': 'vous a invité à rejoindre la bêta',
  'invite.subhead': 'Soyez parmi les premiers à découvrir le nouveau marché de services de Calgary.',
  'invite.body1':
    'Swingbyy met en relation les personnes qui cherchent un service avec des entreprises locales qualifiées — des réparations à domicile à l’entraînement personnel, au même endroit.',
  'invite.body2':
    'En tant que testeur bêta, vos commentaires façonnent directement l’application. Dites-nous ce qui fonctionne, ce qui ne fonctionne pas et ce que vous aimeriez y trouver.',
  'invite.codeLabel': 'Votre code d’invitation',
  'invite.copy': 'Copier le code',
  'invite.copied': 'Code copié',
  'invite.copyFailed': 'Impossible de copier le code',
  'invite.cta': 'Rejoindre la bêta',
  'invite.haveAccount': 'Vous avez déjà un compte?',
  'invite.signIn': 'Se connecter',
  'invite.finePrint': 'Cette invitation vous est personnelle. Merci de ne pas la partager.',
  'invite.copyright': '© 2026 Swingbyy',
  'invite.noCodeTitle': 'Ce lien d’invitation est incomplet',
  'invite.noCodeBody':
    'Le lien ne contenait pas de code d’invitation. Ouvrez de nouveau le lien d’origine, ou inscrivez-vous sans code — vous pourrez en ajouter un plus tard.',
  'invite.continueAnyway': 'Continuer sans code',
});

Object.assign(translations.ar, {
  'invite.badge': 'نسخة تجريبية',
  'invite.hero': 'أنت مدعو للمساهمة في تشكيل Swingbyy',
  'invite.inviter': 'فريق Swingbyy',
  'invite.inviterRole': 'دعاك للانضمام إلى النسخة التجريبية',
  'invite.subhead': 'كن من أوائل من يجرب سوق الخدمات الجديد في كالغاري.',
  'invite.body1':
    'يربط Swingbyy الأشخاص الذين يحتاجون إلى خدمات بأنشطة تجارية محلية ماهرة — من إصلاحات المنزل إلى التدريب الشخصي، في مكان واحد.',
  'invite.body2':
    'بصفتك مختبرًا للنسخة التجريبية، تسهم ملاحظاتك مباشرة في تطوير التطبيق. أخبرنا بما ينجح، وما لا ينجح، وما تتمنى وجوده.',
  'invite.codeLabel': 'رمز الدعوة الخاص بك',
  'invite.copy': 'نسخ الرمز',
  'invite.copied': 'تم نسخ الرمز',
  'invite.copyFailed': 'تعذّر نسخ الرمز',
  'invite.cta': 'انضم إلى النسخة التجريبية',
  'invite.haveAccount': 'هل لديك حساب بالفعل؟',
  'invite.signIn': 'تسجيل الدخول',
  'invite.finePrint': 'هذه الدعوة شخصية لك. نرجو عدم مشاركتها.',
  'invite.copyright': '© 2026 Swingbyy',
  'invite.noCodeTitle': 'رابط الدعوة غير مكتمل',
  'invite.noCodeBody':
    'لم يتضمن الرابط رمز دعوة. افتح الرابط الأصلي مرة أخرى، أو سجّل بدون رمز — يمكنك إضافته لاحقًا.',
  'invite.continueAnyway': 'المتابعة بدون رمز',
});

Object.assign(translations.uk, {
  'invite.badge': 'БЕТА',
  'invite.hero': 'Вас запрошено формувати Swingbyy',
  'invite.inviter': 'Команда Swingbyy',
  'invite.inviterRole': 'запросила вас до бета-версії',
  'invite.subhead': 'Станьте одним із перших, хто скористається новим сервісним маркетплейсом Калгарі.',
  'invite.body1':
    'Swingbyy поєднує людей, яким потрібні послуги, з кваліфікованими місцевими підприємствами — від ремонту вдома до персональних тренувань, усе в одному місці.',
  'invite.body2':
    'Як бета-тестувальник ви безпосередньо впливаєте на застосунок. Розкажіть, що працює, що ні та чого вам бракує.',
  'invite.codeLabel': 'Ваш код запрошення',
  'invite.copy': 'Копіювати код',
  'invite.copied': 'Код скопійовано',
  'invite.copyFailed': 'Не вдалося скопіювати код',
  'invite.cta': 'Приєднатися до бети',
  'invite.haveAccount': 'Уже маєте обліковий запис?',
  'invite.signIn': 'Увійти',
  'invite.finePrint': 'Це запрошення персональне. Будь ласка, не діліться ним.',
  'invite.copyright': '© 2026 Swingbyy',
  'invite.noCodeTitle': 'Це посилання-запрошення неповне',
  'invite.noCodeBody':
    'Посилання не містило коду запрошення. Відкрийте початкове посилання ще раз або зареєструйтеся без коду — додати його можна пізніше.',
  'invite.continueAnyway': 'Продовжити без коду',
});

// ─── D5 — Wallet / payouts ───────────────────────────────────────────────────
//
// COPY RULES ENFORCED HERE, because this block states what happens to somebody's
// money and the repo has already had to pull two false money claims from
// production (the 50/50 staged release, and "cancel free up to 24h" against a
// real 48h ladder):
//
//   · The 10% figure is `escrow.PLATFORM_RATE`. It is the only percentage in
//     this block and it is not repeated anywhere it could drift.
//   · "Instant" appears ONLY on strings the app shows when Stripe has confirmed
//     an instant-capable debit card, and on the result string chosen by the
//     server's own `method` field. Every other path says bank transfer.
//   · Arrival times are characterised, not promised: Stripe publishes ~30
//     minutes for instant payouts, and a standard payout depends on the
//     receiving bank. Neither is a SwingBy SLA and neither is written as one.
const walletEn = {
  'wallet.title': 'Wallet',
  'wallet.availableLabel': 'Available to cash out',
  'wallet.availableCaption':
    'Money released to you from finished jobs, after Swingbyy’s 10% fee, minus anything you’ve already cashed out.',
  'wallet.lifetimeEarned': 'Earned all time',
  'wallet.alreadyPaidOut': 'Already cashed out',

  'wallet.cashOutCta': 'Cash out',
  'wallet.nothingToCashOut': 'Nothing to cash out yet.',
  'wallet.cashOutConfirmTitle': 'Cash out?',
  'wallet.cashOutConfirmInstant':
    '%{amount} will be sent to your debit card. Instant payouts usually arrive within about 30 minutes.',
  'wallet.cashOutConfirmStandard':
    '%{amount} will be sent to your bank account. Standard transfers usually take a few business days.',
  'wallet.cashOutDoneTitle': 'On its way',
  'wallet.cashOutDoneInstant': '%{amount} was sent to your debit card.',
  'wallet.cashOutDoneStandard': '%{amount} was sent to your bank account.',
  'wallet.cashOutFailedTitle': 'Could not cash out',

  'wallet.accountReadyTitle': 'Payouts are set up',
  'wallet.railInstant': 'Instant — straight to your debit card.',
  'wallet.railInstantCard': 'Instant — to your debit card ending %{last4}.',
  'wallet.railStandard': 'Standard bank transfer — usually a few business days.',
  'wallet.managePayoutMethod': 'Manage payout method',
  'wallet.manageFailedTitle': 'Could not open payout settings',

  // Title and CTA must not be the same string. Beyond reading as a stutter, a
  // card whose heading and button are identical is ambiguous to a screen reader
  // (and to getByText).
  'wallet.setupTitle': 'Get paid for your work',
  'wallet.setupBody':
    'Add your details and a debit card or bank account so your earnings can reach you. Stripe handles this and Swingbyy never sees your card number.',
  'wallet.setupCta': 'Set up payouts',
  'wallet.setupFailedTitle': 'Could not start setup',

  'wallet.incompleteTitle': 'Finish setting up payouts',
  'wallet.incompleteBody':
    'You started setting up payouts but didn’t finish. Your earnings are safe — they just can’t be sent yet.',
  'wallet.incompleteCta': 'Finish setup',

  'wallet.pendingTitle': 'Stripe is reviewing your details',
  'wallet.pendingBody':
    'You’ve sent everything in. Stripe is checking it — this usually doesn’t take long. You can cash out once it’s approved.',
  'wallet.pendingCta': 'Check or update details',

  'wallet.restrictedTitle': 'Payouts are paused',
  'wallet.restrictedBody':
    'Stripe has paused payouts on your account until something is sorted out. Your earnings are still yours.',
  'wallet.restrictedCta': 'Fix this with Stripe',
  'wallet.stripeReason': 'Stripe says: %{reason}',

  'wallet.historyTitle': 'Cash-outs',
  'wallet.emptyTitle': 'No cash-outs yet',
  'wallet.emptyBody': 'When you take money out, it will show up here.',
  'wallet.errorTitle': 'Could not load your wallet',

  'wallet.status.pending': 'Preparing',
  'wallet.status.in_transit': 'On the way',
  'wallet.status.paid': 'Paid',
  'wallet.status.failed': 'Failed',
  'wallet.status.canceled': 'Cancelled',

  'wallet.method.instant': 'Instant',
  'wallet.method.standard': 'Bank transfer',
};
Object.assign(translations.en, walletEn);

Object.assign(translations['fr-CA'], {
  'wallet.title': 'Portefeuille',
  'wallet.availableLabel': 'Disponible pour retrait',
  'wallet.availableCaption':
    'L’argent qui vous a été versé pour des travaux terminés, après les frais de 10 % de Swingbyy, moins ce que vous avez déjà retiré.',
  'wallet.lifetimeEarned': 'Gagné depuis le début',
  'wallet.alreadyPaidOut': 'Déjà retiré',

  'wallet.cashOutCta': 'Retirer',
  'wallet.nothingToCashOut': 'Rien à retirer pour l’instant.',
  'wallet.cashOutConfirmTitle': 'Retirer?',
  'wallet.cashOutConfirmInstant':
    '%{amount} sera envoyé à votre carte de débit. Les virements instantanés arrivent habituellement en 30 minutes environ.',
  'wallet.cashOutConfirmStandard':
    '%{amount} sera envoyé à votre compte bancaire. Les virements standards prennent habituellement quelques jours ouvrables.',
  'wallet.cashOutDoneTitle': 'En route',
  'wallet.cashOutDoneInstant': '%{amount} a été envoyé à votre carte de débit.',
  'wallet.cashOutDoneStandard': '%{amount} a été envoyé à votre compte bancaire.',
  'wallet.cashOutFailedTitle': 'Retrait impossible',

  'wallet.accountReadyTitle': 'Les versements sont configurés',
  'wallet.railInstant': 'Instantané — directement sur votre carte de débit.',
  'wallet.railInstantCard': 'Instantané — sur votre carte de débit se terminant par %{last4}.',
  'wallet.railStandard': 'Virement bancaire standard — habituellement quelques jours ouvrables.',
  'wallet.managePayoutMethod': 'Gérer le mode de versement',
  'wallet.manageFailedTitle': 'Impossible d’ouvrir les réglages de versement',

  'wallet.setupTitle': 'Faites-vous payer pour votre travail',
  'wallet.setupBody':
    'Ajoutez vos renseignements et une carte de débit ou un compte bancaire pour recevoir vos gains. Stripe s’en occupe et Swingbyy ne voit jamais votre numéro de carte.',
  'wallet.setupCta': 'Configurer les versements',
  'wallet.setupFailedTitle': 'Impossible de lancer la configuration',

  'wallet.incompleteTitle': 'Terminez la configuration des versements',
  'wallet.incompleteBody':
    'Vous avez commencé la configuration sans la terminer. Vos gains sont en sécurité — ils ne peuvent simplement pas encore être envoyés.',
  'wallet.incompleteCta': 'Terminer la configuration',

  'wallet.pendingTitle': 'Stripe vérifie vos renseignements',
  'wallet.pendingBody':
    'Vous avez tout envoyé. Stripe fait ses vérifications — c’est habituellement rapide. Vous pourrez retirer une fois approuvé.',
  'wallet.pendingCta': 'Vérifier ou mettre à jour',

  'wallet.restrictedTitle': 'Les versements sont suspendus',
  'wallet.restrictedBody':
    'Stripe a suspendu les versements sur votre compte le temps de régler quelque chose. Vos gains restent les vôtres.',
  'wallet.restrictedCta': 'Régler cela avec Stripe',
  'wallet.stripeReason': 'Stripe indique : %{reason}',

  'wallet.historyTitle': 'Retraits',
  'wallet.emptyTitle': 'Aucun retrait pour l’instant',
  'wallet.emptyBody': 'Lorsque vous retirerez de l’argent, cela apparaîtra ici.',
  'wallet.errorTitle': 'Impossible de charger votre portefeuille',

  'wallet.status.pending': 'En préparation',
  'wallet.status.in_transit': 'En route',
  'wallet.status.paid': 'Versé',
  'wallet.status.failed': 'Échec',
  'wallet.status.canceled': 'Annulé',

  'wallet.method.instant': 'Instantané',
  'wallet.method.standard': 'Virement bancaire',
});

Object.assign(translations.ar, {
  'wallet.title': 'المحفظة',
  'wallet.availableLabel': 'المتاح للسحب',
  'wallet.availableCaption':
    'الأموال التي حُوّلت إليك من الأعمال المنتهية، بعد رسوم Swingbyy البالغة 10%، ناقص ما سحبته سابقًا.',
  'wallet.lifetimeEarned': 'إجمالي الأرباح',
  'wallet.alreadyPaidOut': 'تم سحبه سابقًا',

  'wallet.cashOutCta': 'سحب',
  'wallet.nothingToCashOut': 'لا يوجد رصيد للسحب حاليًا.',
  'wallet.cashOutConfirmTitle': 'هل تريد السحب؟',
  'wallet.cashOutConfirmInstant':
    'سيتم إرسال %{amount} إلى بطاقة الخصم الخاصة بك. التحويلات الفورية تصل عادةً خلال 30 دقيقة تقريبًا.',
  'wallet.cashOutConfirmStandard':
    'سيتم إرسال %{amount} إلى حسابك المصرفي. التحويلات العادية تستغرق عادةً بضعة أيام عمل.',
  'wallet.cashOutDoneTitle': 'في الطريق',
  'wallet.cashOutDoneInstant': 'تم إرسال %{amount} إلى بطاقة الخصم الخاصة بك.',
  'wallet.cashOutDoneStandard': 'تم إرسال %{amount} إلى حسابك المصرفي.',
  'wallet.cashOutFailedTitle': 'تعذّر السحب',

  'wallet.accountReadyTitle': 'تم إعداد التحويلات',
  'wallet.railInstant': 'فوري — مباشرةً إلى بطاقة الخصم الخاصة بك.',
  'wallet.railInstantCard': 'فوري — إلى بطاقة الخصم المنتهية بـ %{last4}.',
  'wallet.railStandard': 'تحويل مصرفي عادي — عادةً بضعة أيام عمل.',
  'wallet.managePayoutMethod': 'إدارة طريقة التحويل',
  'wallet.manageFailedTitle': 'تعذّر فتح إعدادات التحويل',

  'wallet.setupTitle': 'احصل على أجر عملك',
  'wallet.setupBody':
    'أضف بياناتك وبطاقة خصم أو حسابًا مصرفيًا حتى تصلك أرباحك. تتولى Stripe ذلك، ولا يرى Swingbyy رقم بطاقتك أبدًا.',
  'wallet.setupCta': 'إعداد التحويلات',
  'wallet.setupFailedTitle': 'تعذّر بدء الإعداد',

  'wallet.incompleteTitle': 'أكمل إعداد التحويلات',
  'wallet.incompleteBody':
    'بدأت الإعداد ولم تكمله. أرباحك محفوظة — لكن لا يمكن إرسالها بعد.',
  'wallet.incompleteCta': 'إكمال الإعداد',

  'wallet.pendingTitle': 'تراجع Stripe بياناتك',
  'wallet.pendingBody':
    'لقد أرسلت كل شيء. تقوم Stripe بالتحقق — وهذا لا يستغرق وقتًا طويلًا عادةً. يمكنك السحب بعد الموافقة.',
  'wallet.pendingCta': 'مراجعة البيانات أو تحديثها',

  'wallet.restrictedTitle': 'التحويلات متوقفة مؤقتًا',
  'wallet.restrictedBody':
    'أوقفت Stripe التحويلات على حسابك مؤقتًا حتى تتم معالجة أمر ما. أرباحك تظل ملكك.',
  'wallet.restrictedCta': 'معالجة الأمر مع Stripe',
  'wallet.stripeReason': 'تقول Stripe: %{reason}',

  'wallet.historyTitle': 'عمليات السحب',
  'wallet.emptyTitle': 'لا توجد عمليات سحب بعد',
  'wallet.emptyBody': 'عندما تسحب أموالك، ستظهر هنا.',
  'wallet.errorTitle': 'تعذّر تحميل محفظتك',

  'wallet.status.pending': 'قيد التجهيز',
  'wallet.status.in_transit': 'في الطريق',
  'wallet.status.paid': 'تم الدفع',
  'wallet.status.failed': 'فشل',
  'wallet.status.canceled': 'أُلغي',

  'wallet.method.instant': 'فوري',
  'wallet.method.standard': 'تحويل مصرفي',
});

Object.assign(translations.uk, {
  'wallet.title': 'Гаманець',
  'wallet.availableLabel': 'Доступно до виведення',
  'wallet.availableCaption':
    'Кошти, перераховані вам за завершені роботи, після комісії Swingbyy 10%, мінус те, що ви вже вивели.',
  'wallet.lifetimeEarned': 'Зароблено за весь час',
  'wallet.alreadyPaidOut': 'Уже виведено',

  'wallet.cashOutCta': 'Вивести',
  'wallet.nothingToCashOut': 'Поки немає чого виводити.',
  'wallet.cashOutConfirmTitle': 'Вивести кошти?',
  'wallet.cashOutConfirmInstant':
    '%{amount} буде надіслано на вашу дебетову картку. Миттєві виплати зазвичай надходять приблизно за 30 хвилин.',
  'wallet.cashOutConfirmStandard':
    '%{amount} буде надіслано на ваш банківський рахунок. Звичайні перекази зазвичай тривають кілька робочих днів.',
  'wallet.cashOutDoneTitle': 'У дорозі',
  'wallet.cashOutDoneInstant': '%{amount} надіслано на вашу дебетову картку.',
  'wallet.cashOutDoneStandard': '%{amount} надіслано на ваш банківський рахунок.',
  'wallet.cashOutFailedTitle': 'Не вдалося вивести кошти',

  'wallet.accountReadyTitle': 'Виплати налаштовано',
  'wallet.railInstant': 'Миттєво — просто на вашу дебетову картку.',
  'wallet.railInstantCard': 'Миттєво — на вашу дебетову картку, що закінчується на %{last4}.',
  'wallet.railStandard': 'Звичайний банківський переказ — зазвичай кілька робочих днів.',
  'wallet.managePayoutMethod': 'Керувати способом виплати',
  'wallet.manageFailedTitle': 'Не вдалося відкрити налаштування виплат',

  'wallet.setupTitle': 'Отримуйте гроші за свою роботу',
  'wallet.setupBody':
    'Додайте свої дані та дебетову картку або банківський рахунок, щоб отримувати зароблене. Цим займається Stripe, і Swingbyy ніколи не бачить номер вашої картки.',
  'wallet.setupCta': 'Налаштувати виплати',
  'wallet.setupFailedTitle': 'Не вдалося розпочати налаштування',

  'wallet.incompleteTitle': 'Завершіть налаштування виплат',
  'wallet.incompleteBody':
    'Ви почали налаштування, але не завершили його. Ваші кошти в безпеці — їх просто поки не можна надіслати.',
  'wallet.incompleteCta': 'Завершити налаштування',

  'wallet.pendingTitle': 'Stripe перевіряє ваші дані',
  'wallet.pendingBody':
    'Ви надіслали все потрібне. Stripe перевіряє — зазвичай це недовго. Вивести кошти можна буде після схвалення.',
  'wallet.pendingCta': 'Переглянути або оновити дані',

  'wallet.restrictedTitle': 'Виплати призупинено',
  'wallet.restrictedBody':
    'Stripe призупинив виплати на вашому рахунку, доки щось не буде врегульовано. Ваші кошти залишаються вашими.',
  'wallet.restrictedCta': 'Врегулювати зі Stripe',
  'wallet.stripeReason': 'Stripe повідомляє: %{reason}',

  'wallet.historyTitle': 'Виведення коштів',
  'wallet.emptyTitle': 'Виведень поки немає',
  'wallet.emptyBody': 'Коли ви виведете кошти, вони з’являться тут.',
  'wallet.errorTitle': 'Не вдалося завантажити гаманець',

  'wallet.status.pending': 'Готується',
  'wallet.status.in_transit': 'У дорозі',
  'wallet.status.paid': 'Виплачено',
  'wallet.status.failed': 'Помилка',
  'wallet.status.canceled': 'Скасовано',

  'wallet.method.instant': 'Миттєво',
  'wallet.method.standard': 'Банківський переказ',
});

// The proof-of-work / mark-complete copy corrected during the 2026-08-06
// walkthrough. These strings say WHEN money moves, so they are the last place
// a loose translation is acceptable: marking complete HOLDS payment and opens
// the client's 24h approval window — it does not release anything. Wording
// follows the escrow vocabulary already established per locale
// ('libérer/retenu en fiducie', 'محتجز في الضمان/يُحرَّر', 'на депонуванні').
Object.assign(translations['fr-CA'], {
  'booking.eventPaymentReleased': 'Paiement libéré',
  'proof.submitToast.title': 'Preuve enregistrée',
  'proof.submitToast.body':
    'Marquez le travail comme terminé pour l’envoyer au client pour approbation.',
  'proof.progress.submittedTitle': 'Preuve envoyée',
  'proof.progress.submittedSubtitle': 'En attente de l’approbation du client',
  'proof.progress.submittedBadge': 'En attente d’approbation',
  'proof.progress.approvedTitle': 'Preuve approuvée',
  'proof.progress.approvedSubtitle': 'Le client a approuvé ce travail',
  'proof.progress.approvedBadge': 'Approuvée',
  'jobStages.confirmComplete':
    'Marquer le travail comme terminé? Le paiement est retenu en fiducie et le client a 24 heures pour l’approuver.',
});

Object.assign(translations.ar, {
  'booking.eventPaymentReleased': 'تم تحرير الدفعة',
  'proof.submitToast.title': 'تم حفظ الدليل',
  'proof.submitToast.body': 'حدِّد العمل كمكتمل لإرساله إلى العميل للموافقة.',
  'proof.progress.submittedTitle': 'تم إرسال الدليل',
  'proof.progress.submittedSubtitle': 'في انتظار موافقة العميل',
  'proof.progress.submittedBadge': 'في انتظار الموافقة',
  'proof.progress.approvedTitle': 'تمت الموافقة على الدليل',
  'proof.progress.approvedSubtitle': 'وافق العميل على هذا العمل',
  'proof.progress.approvedBadge': 'تمت الموافقة',
  'jobStages.confirmComplete':
    'هل تريد تحديد العمل كمكتمل؟ يبقى المبلغ محتجزًا في الضمان ويحصل العميل على 24 ساعة للموافقة.',
});

Object.assign(translations.uk, {
  'booking.eventPaymentReleased': 'Платіж переказано',
  'proof.submitToast.title': 'Підтвердження збережено',
  'proof.submitToast.body':
    'Позначте роботу як завершену, щоб надіслати її клієнту на схвалення.',
  'proof.progress.submittedTitle': 'Підтвердження надіслано',
  'proof.progress.submittedSubtitle': 'Очікує схвалення клієнта',
  'proof.progress.submittedBadge': 'Очікує схвалення',
  'proof.progress.approvedTitle': 'Підтвердження схвалено',
  'proof.progress.approvedSubtitle': 'Клієнт схвалив цю роботу',
  'proof.progress.approvedBadge': 'Схвалено',
  'jobStages.confirmComplete':
    'Позначити роботу як завершену? Платіж залишається на депонуванні, і клієнт має 24 години, щоб його схвалити.',
});

// ── The "needs your OK" card on client Home — walkthrough bug 1, 2026-08-09 ──
// The client was never told there was anything to approve: the prompt lived
// five taps deep under My Jobs → Past, badged DONE, while a 24h timer released
// the money on its own. This copy is the prompt, so it is money copy — all four
// locales, no English fallback, same rule as the approval.* block above whose
// buttons and confirm alert this card reuses.
Object.assign(translations.en, {
  'approvalCard.eyebrow': 'NEEDS YOUR OK',
  'approvalCard.title': '%{business} finished your job',
  'approvalCard.amountHeld': '%{amount} held — released when you approve',
  'approvalCard.amountUnknown': 'Your payment is held until you approve',
  'approvalCard.deadlineHours': 'Releases in %{hours}h',
  'approvalCard.deadlineSoon': 'Releases within the hour',
  'approvalCard.deadlineNow': 'Releasing now',
  'approvalCard.seePhotos': 'See the photos first',
  'approvalCard.somethingWrong': 'Something’s wrong',
  'approvalCard.a11yReview':
    'Review the work %{business} sent, with the photos, before you approve',
  // My Jobs → Past. The row used to be badged "Done" in green while the money
  // still needed an answer: done is true of the work, false of the payment.
  'approvalCard.badge': 'Needs your OK',
  'approvalCard.reviewAction': 'Review & approve',
});

Object.assign(translations['fr-CA'], {
  'approvalCard.eyebrow': 'VOTRE ACCORD',
  'approvalCard.title': '%{business} a terminé votre travail',
  'approvalCard.amountHeld': '%{amount} retenu — libéré dès votre approbation',
  'approvalCard.amountUnknown': 'Votre paiement est retenu jusqu’à votre approbation',
  'approvalCard.deadlineHours': 'Libéré dans %{hours} h',
  'approvalCard.deadlineSoon': 'Libéré d’ici une heure',
  'approvalCard.deadlineNow': 'Libération en cours',
  'approvalCard.seePhotos': 'Voir les photos d’abord',
  'approvalCard.somethingWrong': 'Il y a un problème',
  'approvalCard.a11yReview':
    'Examiner le travail envoyé par %{business}, avec les photos, avant d’approuver',
  'approvalCard.badge': 'Votre accord requis',
  'approvalCard.reviewAction': 'Examiner et approuver',
});

Object.assign(translations.ar, {
  'approvalCard.eyebrow': 'بانتظار موافقتك',
  'approvalCard.title': 'أنهى %{business} عملك',
  'approvalCard.amountHeld': '%{amount} محتجز في الضمان — يُحرَّر عند موافقتك',
  'approvalCard.amountUnknown': 'دفعتك محتجزة في الضمان حتى توافق',
  'approvalCard.deadlineHours': 'يُحرَّر خلال %{hours} ساعة',
  'approvalCard.deadlineSoon': 'يُحرَّر خلال ساعة',
  'approvalCard.deadlineNow': 'يجري تحريره الآن',
  'approvalCard.seePhotos': 'اطّلع على الصور أولاً',
  'approvalCard.somethingWrong': 'هناك مشكلة',
  'approvalCard.a11yReview': 'راجع العمل الذي أرسله %{business} مع الصور قبل الموافقة',
  'approvalCard.badge': 'بانتظار موافقتك',
  'approvalCard.reviewAction': 'المراجعة والموافقة',
});

Object.assign(translations.uk, {
  'approvalCard.eyebrow': 'ПОТРІБНЕ ВАШЕ СХВАЛЕННЯ',
  'approvalCard.title': '%{business} завершив вашу роботу',
  'approvalCard.amountHeld': '%{amount} на депонуванні — переказ після схвалення',
  'approvalCard.amountUnknown': 'Ваш платіж на депонуванні, доки ви не схвалите',
  'approvalCard.deadlineHours': 'Переказ через %{hours} год',
  'approvalCard.deadlineSoon': 'Переказ протягом години',
  'approvalCard.deadlineNow': 'Переказ виконується',
  'approvalCard.seePhotos': 'Спершу перегляньте фото',
  'approvalCard.somethingWrong': 'Щось не так',
  'approvalCard.a11yReview':
    'Перегляньте роботу, яку надіслав %{business}, разом із фото, перш ніж схвалити',
  'approvalCard.badge': 'Потрібне схвалення',
  'approvalCard.reviewAction': 'Переглянути й схвалити',
});

const i18n = new I18n(translations);

// Default fallback
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
// Our keys are flat strings containing dots ('booking.proposeTimes'). i18n-js v4
// splits scopes on '.' into a nested path, so every lookup missed — in every
// locale. NUL can't appear in a key, so this makes each key one flat segment.
i18n.defaultSeparator = String.fromCharCode(0);

// Restore persisted locale on import (fire-and-forget)
(async () => {
  try {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY);
    if (stored) {
      i18n.locale = stored;
    } else {
      // Use device locale if supported, else fallback en. `resolveLocale`
      // is the shared registry's matcher — the same list LanguageSelector
      // offers, so a language can never be detectable but unpickable (which
      // is exactly what happened to Arabic) or the reverse.
      const deviceLocale = Localization.getLocales?.()?.[0]?.languageTag ?? Localization.locale ?? 'en';
      i18n.locale = resolveLocale(deviceLocale);
    }
  } catch {
    i18n.locale = 'en';
  }
  // Line the native layout direction up with whatever locale we just settled
  // on. Sets the flag only — deliberately does NOT restart here; see the note
  // on syncDirectionOnBoot about boot loops.
  syncDirectionOnBoot(i18n.locale);
})();

/**
 * Switch language, persist it, and report whether the LAYOUT also has to flip.
 *
 * Returns `{ needsRestart }`. Callers must act on it: a locale change between
 * an LTR and an RTL language leaves the running UI in the old direction until
 * the app reloads, because native reads the direction once at process start.
 * Ignoring this is what produces a screen with Arabic text in a left-to-right
 * layout — the exact state this app shipped in before 2026-07-30.
 */
export async function setLocale(locale) {
  i18n.locale = locale;
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  } catch { /* non-fatal */ }

  let needsRestart = false;
  try {
    needsRestart = applyDirection(locale);
  } catch { /* direction is best-effort; never block a language change */ }

  return { needsRestart };
}

export default i18n;
