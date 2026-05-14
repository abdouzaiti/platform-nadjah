import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  ar: {
    translation: {
      "app_name": "نجاح لايف",
      "login_title": "مدرسة نجاح",
      "login_subtitle": "منصة البث الأكاديمي المتقدمة",
      "access_dashboard": "الدخول إلى لوحة التحكم",
      "authenticating": "جاري التحقق...",
      "email_address": "البريد الإلكتروني",
      "password": "كلمة المرور",
      "google_account": "حساب جوجل",
      "professional_engine": "محرك بث احترافي",
      "sign_out": "تسجيل الخروج",
      "welcome_professor": "مرحباً، البروفيسور",
      "academic_control": "التحكم الأكاديمي",
      "teacher_communities": "مجتمعات الأساتذة",
      "rooms": "الغرف",
      "add_room": "إضافة غرفة",
      "new_room": "غرفة جديدة",
      "room_name": "اسم الغرفة",
      "create_room": "إنشاء غرفة",
      "go_live": "بث مباشر",
      "open": "فتح",
      "members": "الأعضاء",
      "join_room": "انضمام للغرفة",
      "member": "عضو",
      "discover": "اكتشاف",
      "joined": "المنضمة",
      "search_community": "البحث عن مجتمع...",
      "create_community": "إنشاء مجتمعك",
      "community_name": "اسم المجتمع",
      "community_username": "اسم المستخدم للمجتمع",
      "launch_community": "إطلاق المجتمع",
      "end_session": "إنهاء الجلسة؟",
      "end_session_hint": "سيؤدي هذا إلى فصل جميع الطلاب. يمكنك اختياريا توفير رابط تسجيل.",
      "finish_publish": "إنهاء ونشر",
      "cancel": "إلغاء",
      "live_session": "جلسة مباشرة",
      "type_message": "اكتب رسالة...",
      "connect_audio": "تفعيل الصوت"
    }
  },
  en: {
    translation: {
      "app_name": "Nadjah Live",
      "login_title": "Ecole Nadjah",
      "login_subtitle": "Advanced Academic Streaming Platform",
      "access_dashboard": "Access Dashboard",
      "authenticating": "Authenticating...",
      "email_address": "Email Address",
      "password": "Password",
      "google_account": "Google Account",
      "professional_engine": "Professional Streaming Engine",
      "sign_out": "Sign Out",
      "welcome_professor": "Welcome, Professor",
      "academic_control": "Academic Control",
      "teacher_communities": "Teacher Communities",
      "rooms": "Rooms",
      "add_room": "Add Room",
      "new_room": "New Room",
      "room_name": "Room Name",
      "create_room": "Create Room",
      "go_live": "Go Live",
      "open": "Open",
      "members": "Members",
      "join_room": "Join Room",
      "member": "Member",
      "discover": "Discover",
      "joined": "Joined",
      "search_community": "Search community...",
      "create_community": "Create Your Community",
      "community_name": "Community Name",
      "community_username": "Community Username",
      "launch_community": "Launch Community",
      "end_session": "End Session?",
      "end_session_hint": "This will disconnect all students. You can optionally provide a recording URL.",
      "finish_publish": "Finish & Publish",
      "cancel": "Cancel",
      "live_session": "Live Session",
      "type_message": "Type a message...",
      "connect_audio": "Connect Audio"
    }
  },
  fr: {
    translation: {
      "app_name": "Nadjah Live",
      "login_title": "École Nadjah",
      "login_subtitle": "Plateforme de streaming académique avancée",
      "access_dashboard": "Accéder au tableau de bord",
      "authenticating": "Authentification...",
      "email_address": "Adresse e-mail",
      "password": "Mot de passe",
      "google_account": "Compte Google",
      "professional_engine": "Moteur de streaming professionnel",
      "sign_out": "Déconnexion",
      "welcome_professor": "Bienvenue, Professeur",
      "academic_control": "Contrôle académique",
      "teacher_communities": "Communautés d'enseignants",
      "rooms": "Salles",
      "add_room": "Ajouter une salle",
      "new_room": "Nouvelle salle",
      "room_name": "Nom de la salle",
      "create_room": "Créer une salle",
      "go_live": "Passer en direct",
      "open": "Ouvrir",
      "members": "Membres",
      "join_room": "Rejoindre la salle",
      "member": "Membre",
      "discover": "Découvrir",
      "joined": "Rejoint",
      "search_community": "Rechercher une communauté...",
      "create_community": "Créez votre communauté",
      "community_name": "Nom de la communauté",
      "community_username": "Nom d'utilisateur de la communauté",
      "launch_community": "Lancer la communauté",
      "end_session": "Terminer la session ?",
      "end_session_hint": "Cela déconnectera tous les étudiants. Vous pouvez éventuellement fournir une URL d'enregistrement.",
      "finish_publish": "Terminer et Publier",
      "cancel": "Annuler",
      "live_session": "Session en direct",
      "type_message": "Écrivez un message...",
      "connect_audio": "Connecter l'audio"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    lng: 'ar', // Default Arabic
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

// Handle RTL for Arabic
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = (lng === 'ar') ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
