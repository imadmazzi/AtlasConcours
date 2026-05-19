const TRANSLATIONS = {
  ar: {
    "nav_home": "الرئيسية",
    "nav_concours": "المباريات",
    "nav_emplois": "الوظائف",
    "nav_blog": "المدونة",
    "hero_badge": "رقم 1 للمباريات العمومية بالمغرب",
    "hero_title_1": "ابحث عن أحدث",
    "hero_title_2": "المباريات في المغرب",
    "hero_desc": "جميع المباريات العمومية، عروض العمل ونصائح المسار المهني في مكان واحد.",
    "search_placeholder": "ابحث عن مباراة، وزارة...",
    "cat_all": "جميع الفئات",
    "cat_sec": "الأمن",
    "cat_edu": "التعليم",
    "cat_sante": "الصحة",
    "cat_admin": "الإدارة",
    "cat_ing": "الهندسة",
    "cat_just": "العدل",
    "btn_search": "بحث",
    "stat_concours": "مباريات نشطة",
    "stat_emplois": "عروض عمل",
    "stat_articles": "مقالات",
    "stat_candidats": "مرشحين تمت مساعدتهم",
    "sec_latest_concours": "أحدث المباريات",
    "see_all_concours": "عرض جميع المباريات",
    "sec_latest_emplois": "عروض العمل الحديثة",
    "see_all_emplois": "عرض جميع العروض",
    "sec_blog": "نصائح المسار المهني",
    "see_all_blog": "عرض جميع المقالات",
    "news_title": "لا تفوت أي مباراة بعد الآن!",
    "news_desc": "توصل بتنبيهات المباريات مباشرة في بريدك الإلكتروني.",
    "news_placeholder": "بريدك@الالكتروني.com",
    "btn_subscribe": "اشترك",
    "footer_desc": "المرجع المغربي للمباريات العمومية، عروض العمل ونصائح المسار المهني. نرافقك نحو النجاح.",
    "footer_nav": "تصفح",
    "footer_cat": "الفئات",
    "footer_contact": "اتصال",
    "footer_about": "من نحن",
    "footer_contact_us": "اتصل بنا",
    "footer_sitemap": "خريطة الموقع",
    "footer_bottom": "© 2026 AtlasConcours.ma — جميع الحقوق محفوظة | المنصة المغربية للمباريات العمومية",
    "page_concours_title": "جميع المباريات العمومية",
    "page_emplois_title": "عروض العمل",
    "page_blog_title": "المدونة و النصائح",
    "sort_latest": "الأحدث",
    "sort_deadline": "الأقرب أجلا",
    "btn_read_more": "تفاصيل المباراة",
    "btn_view_job": "تقديم الترشيح",
    "btn_read": "قراءة المقال",
    "empty_concours": "لا توجد مباريات.",
    "empty_emplois": "لا توجد عروض.",
    "empty_articles": "لا توجد مقالات.",
    "share_title": "شارك",
    "similaires_title": "مباريات مشابهة",
    "Sécurité": "الأمن",
    "Éducation": "التعليم",
    "Santé": "الصحة",
    "Administration": "الإدارة",
    "Ingénierie": "الهندسة",
    "Justice": "العدل",
    "Entreprises Publiques": "المؤسسات العمومية",
    "Général": "عام"
  }
};

export function getLang() {
  return localStorage.getItem('ac_lang') || 'fr';
}

export function setLang(lang) {
  localStorage.setItem('ac_lang', lang);
  window.location.reload();
}

export function tr(key) {
  const lang = getLang();
  if (lang === 'fr') {
    // For FR, we just return the key if it's an exact word like "Sécurité", 
    // but for UI elements we might need a FR dictionary or fallback to children.
    // In our React setup, we'll use a slightly different pattern for simplicity:
    // If it's a known UI key, we just pass children in the component, OR we provide FR translations here.
    return key;
  }
  return TRANSLATIONS.ar[key] || key;
}

export function applyRtl() {
  const lang = getLang();
  if (lang === 'ar') {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    const style = document.createElement('style');
    style.innerHTML = `
      .navbar .nav-links { margin-left: 0; margin-right: auto; }
      .footer-grid { text-align: right; }
      .hero { text-align: center; }
      .search-box button { border-radius: 30px 0 0 30px; margin-left: 0; }
      .search-box input { border-radius: 0 30px 30px 0; }
      .search-box select { border-left: 1px solid #e2e8f0; border-right: none; }
      .social-float { left: 28px; right: auto; }
      .detail-content ul { padding-right: 20px; padding-left: 0; }
      .emploi-meta span i, .card-date span.icon, .card-date i { margin-left: 6px; margin-right: 0; }
      .btn i.fa-arrow-right { transform: scaleX(-1); }
      .see-all i { transform: scaleX(-1); }
      .card-footer, .blog-footer, .detail-header-meta { flex-direction: row; }
      .stats-grid, .top-grids, .charts-grid { direction: rtl; }
      th { text-align: right; }
    `;
    document.head.appendChild(style);
  }
}
