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
    'booking.confirmedFor': 'Confirmed for %{date}',
    'booking.dateConfirmedToast': 'Date confirmed',
    'booking.confirmDateErrorToast': 'Could not confirm date',
    'booking.viewFullDetails': 'View full details',
    'booking.detailsAction': 'Details',

    // Post a job — category picker
    'postJob.categoryOther': 'Other / General',
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
    'booking.confirmedFor': 'Confirmé pour le %{date}',
    'booking.dateConfirmedToast': 'Date confirmée',
    'booking.confirmDateErrorToast': 'Impossible de confirmer la date',
    'booking.viewFullDetails': 'Voir tous les détails',
    'booking.detailsAction': 'Détails',

    // Post a job — category picker
    'postJob.categoryOther': 'Autre / Général',
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
    'booking.confirmedFor': 'تم التأكيد بتاريخ %{date}',
    'booking.dateConfirmedToast': 'تم تأكيد التاريخ',
    'booking.confirmDateErrorToast': 'تعذر تأكيد التاريخ',
    'booking.viewFullDetails': 'عرض كل التفاصيل',
    'booking.detailsAction': 'التفاصيل',

    // Post a job — category picker
    'postJob.categoryOther': 'أخرى / عام',
  },
};

const i18n = new I18n(translations);

// Default fallback
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

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
