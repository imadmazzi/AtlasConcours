import React, { useState } from 'react';

const FAQ_ITEMS = [
  {
    q: 'كيف أجد أحدث مباريات التوظيف؟',
    a: 'موقع AtlasConcours يجمع لك يومياً أحدث المباريات من مختلف القطاعات (التعليم، الصحة، الأمن، الجماعات الترابية...). ما عليك إلا زيارة صفحة "المباريات" والاستعانة بخاصية البحث والتصفية للعثور على ما يناسبك.',
  },
  {
    q: 'هل التسجيل في المباريات يتم عبر الموقع؟',
    a: 'لا. نحن نوفر لك روابط التسجيل الرسمية ومصادر الإعلانات مباشرةً من الجهات المعنية (الوزارات، المؤسسات العمومية...). يكفي النقر على زر "التسجيل الرسمي" في صفحة كل مباراة.',
  },
  {
    q: 'كيف أتوصل بجديد المباريات والوظائف؟',
    a: 'يمكنك متابعتنا على مواقع التواصل الاجتماعي (فيسبوك، إنستغرام، تيليغرام) لتصلك الإشعارات فور نشر أي مباراة أو وظيفة جديدة. كما يمكنك الاشتراك في قناة تيليغرام الرسمية للحصول على تنبيهات فورية.',
  },
  {
    q: 'هل خدمة AtlasConcours مجانية؟',
    a: 'نعم، AtlasConcours خدمة مجانية بالكامل. لا تحتاج إلى إنشاء حساب أو دفع أي رسوم للاطلاع على المباريات والوظائف وروابط التسجيل الرسمية.',
  },
  {
    q: 'ما هي الوثائق المطلوبة عادةً للمباريات؟',
    a: 'تختلف الوثائق المطلوبة حسب كل مباراة وطبيعة المنصب، لكن عادةً ما تحتاج إلى: نسخة من بطاقة التعريف الوطنية، الشواهد والدبلومات، صور شمسية، وطلب الترشيح. تحقق دائماً من الإعلان الرسمي لكل مباراة للاطلاع على القائمة الكاملة.',
  },
];

// JSON-LD schema for Google FAQPage rich results
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section className="faq-section" aria-label="أسئلة شائعة">
      {/* JSON-LD schema injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      <div className="container faq-container">
        <div className="faq-header">
          <span className="faq-badge">FAQ</span>
          <h2 className="faq-title">أسئلة شائعة</h2>
          <p className="faq-subtitle">كل ما تريد معرفته عن خدمة AtlasConcours</p>
        </div>

        <div className="faq-list" role="list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`faq-item${isOpen ? ' faq-item--open' : ''}`}
                role="listitem"
              >
                <button
                  className="faq-question"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-btn-${i}`}
                >
                  <span className="faq-q-icon">
                    <i className="fa fa-question-circle"></i>
                  </span>
                  <span className="faq-q-text">{item.q}</span>
                  <span className={`faq-chevron${isOpen ? ' faq-chevron--up' : ''}`}>
                    <i className="fa fa-chevron-down"></i>
                  </span>
                </button>

                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  className="faq-answer"
                  style={{ maxHeight: isOpen ? '400px' : '0' }}
                >
                  <p className="faq-answer-text">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
