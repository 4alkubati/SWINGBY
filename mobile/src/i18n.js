// T70 — i18n module (i18n-js + expo-localization)
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
// Cross-platform storage wrapper (works on web + native).
import * as SecureStore from './services/storage';

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
    'referral.title': 'Share SwingBy, get $10 credit',
    'referral.body': 'When your friend completes their first booking, you both get $10 off your next job.',
    'referral.shareText': 'Join me on SwingBy! Code: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'Share my code',
    'referral.stats': '%{friends} friends joined • $%{earned} earned',

    // FAQ
    'faq.title': 'Help & FAQ',
    'faq.q1': 'How does SwingBy work?',
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

    // Escrow milestones — read-only (GAP-AUDIT #10)
    'escrow.title': 'Payment protection',
    'escrow.fundsHeld': 'Funds held in escrow',
    'escrow.halfReleased': '50% released on confirm',
    'escrow.fullReleased': 'Released on completion',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'Uploading photo…',
    'profile.photoUpdated': 'Photo updated',
    'profile.photoUploadError': 'Could not upload photo',
    'profile.photoPermission': 'Allow SwingBy to access your photos to set a profile picture.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'Uploading…',
    'dispute.photoUploadError': 'Could not upload photo',
    'dispute.photoPermission': 'Allow SwingBy to access your photos to attach evidence.',
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
    'dashboard.moneyUnavailable': 'Could not load payment totals',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'Unlock SwingBy',
    'biometric.lockedBody': 'Use Face ID, Touch ID, or your fingerprint to continue.',
    'biometric.unlockCta': 'Unlock',
    'biometric.declinedHint': "Didn't work? Try again or sign in differently.",
    'biometric.useDifferentAccount': 'Sign in differently',
    'biometric.prompt': 'Unlock SwingBy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'Face ID / Fingerprint Unlock',
    'settings.biometricUnavailableHint': 'Not set up on this device',
    'settings.biometricUnavailableTitle': 'Not available',
    'settings.biometricUnavailableBody': "Face ID / fingerprint isn't set up on this device yet. Enable it in your device settings, then try again.",
    'settings.biometricConfirmPrompt': 'Confirm to enable biometric unlock',
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
    'referral.title': 'Partagez SwingBy, obtenez 10$ de crédit',
    'referral.body': 'Quand votre ami complète sa première réservation, vous recevez tous les deux 10$ de rabais.',
    'referral.shareText': 'Rejoignez-moi sur SwingBy! Code: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'Partager mon code',
    'referral.stats': '%{friends} amis inscrits • %{earned}$ gagnés',

    // FAQ
    'faq.title': 'Aide et FAQ',
    'faq.q1': 'Comment fonctionne SwingBy?',
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

    // Escrow milestones — read-only (GAP-AUDIT #10)
    'escrow.title': 'Protection du paiement',
    'escrow.fundsHeld': 'Fonds détenus en entiercement',
    'escrow.halfReleased': '50 % libéré à la confirmation',
    'escrow.fullReleased': 'Libéré à la fin du travail',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'Téléchargement de la photo…',
    'profile.photoUpdated': 'Photo mise à jour',
    'profile.photoUploadError': 'Impossible de télécharger la photo',
    'profile.photoPermission': 'Autorisez SwingBy à accéder à vos photos pour définir une photo de profil.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'Téléchargement…',
    'dispute.photoUploadError': 'Impossible de télécharger la photo',
    'dispute.photoPermission': 'Autorisez SwingBy à accéder à vos photos pour joindre des preuves.',
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
    'dashboard.moneyUnavailable': 'Impossible de charger les totaux de paiement',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'Déverrouiller SwingBy',
    'biometric.lockedBody': 'Utilisez Face ID, Touch ID ou votre empreinte digitale pour continuer.',
    'biometric.unlockCta': 'Déverrouiller',
    'biometric.declinedHint': "Ça n'a pas fonctionné? Réessayez ou connectez-vous autrement.",
    'biometric.useDifferentAccount': 'Se connecter autrement',
    'biometric.prompt': 'Déverrouiller SwingBy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'Déverrouillage par Face ID / empreinte',
    'settings.biometricUnavailableHint': 'Non configuré sur cet appareil',
    'settings.biometricUnavailableTitle': 'Non disponible',
    'settings.biometricUnavailableBody': "Face ID ou l'empreinte digitale n'est pas encore configuré sur cet appareil. Activez-le dans les paramètres de votre appareil, puis réessayez.",
    'settings.biometricConfirmPrompt': 'Confirmez pour activer le déverrouillage biométrique',
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
    'referral.title': 'شارك SwingBy واحصل على 10 دولار رصيد',
    'referral.body': 'عندما يُكمل صديقك حجزه الأول، تحصلان معاً على 10 دولار خصماً.',
    'referral.shareText': 'انضم إليّ على SwingBy! الكود: %{code} — https://swingbyy.com',
    'referral.shareCTA': 'شارك كودي',
    'referral.stats': '%{friends} أصدقاء انضموا • %{earned}$ مكسبة',

    // FAQ
    'faq.title': 'المساعدة والأسئلة الشائعة',
    'faq.q1': 'كيف يعمل SwingBy؟',
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

    // Escrow milestones — read-only (GAP-AUDIT #10)
    'escrow.title': 'حماية الدفع',
    'escrow.fundsHeld': 'الأموال محتجزة كضمان',
    'escrow.halfReleased': 'تم تحرير 50% عند التأكيد',
    'escrow.fullReleased': 'تم التحرير عند الاكتمال',

    // Profile photo upload (GAP-AUDIT #11)
    'profile.photoUploading': 'جارٍ رفع الصورة…',
    'profile.photoUpdated': 'تم تحديث الصورة',
    'profile.photoUploadError': 'تعذر رفع الصورة',
    'profile.photoPermission': 'اسمح لـ SwingBy بالوصول إلى صورك لتعيين صورة الملف الشخصي.',

    // Dispute photo upload (GAP-AUDIT #12)
    'dispute.photoUploading': 'جارٍ الرفع…',
    'dispute.photoUploadError': 'تعذر رفع الصورة',
    'dispute.photoPermission': 'اسمح لـ SwingBy بالوصول إلى صورك لإرفاق الأدلة.',
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
    'dashboard.moneyUnavailable': 'تعذر تحميل إجماليات الدفع',

    // Biometric app-lock (CARD-24)
    'biometric.lockedTitle': 'افتح قفل SwingBy',
    'biometric.lockedBody': 'استخدم بصمة الوجه أو بصمة الإصبع لمتابعة الدخول.',
    'biometric.unlockCta': 'فتح القفل',
    'biometric.declinedHint': 'لم ينجح؟ حاول مرة أخرى أو سجّل الدخول بطريقة مختلفة.',
    'biometric.useDifferentAccount': 'تسجيل الدخول بطريقة مختلفة',
    'biometric.prompt': 'افتح قفل SwingBy',

    // Settings — biometric toggle (CARD-24)
    'settings.biometricUnlock': 'فتح القفل ببصمة الوجه / الإصبع',
    'settings.biometricUnavailableHint': 'غير مُعدّ على هذا الجهاز',
    'settings.biometricUnavailableTitle': 'غير متاح',
    'settings.biometricUnavailableBody': 'بصمة الوجه أو الإصبع غير معدة على هذا الجهاز بعد. فعّلها من إعدادات جهازك ثم حاول مرة أخرى.',
    'settings.biometricConfirmPrompt': 'أكّد لتفعيل فتح القفل البيومتري',
  },
};

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
      // Use device locale if supported, else fallback en
      const deviceLocale = Localization.getLocales?.()?.[0]?.languageTag ?? Localization.locale ?? 'en';
      if (deviceLocale.startsWith('fr')) i18n.locale = 'fr-CA';
      else if (deviceLocale.startsWith('ar')) i18n.locale = 'ar';
      else i18n.locale = 'en';
    }
  } catch {
    i18n.locale = 'en';
  }
})();

export async function setLocale(locale) {
  i18n.locale = locale;
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  } catch { /* non-fatal */ }
}

export default i18n;
