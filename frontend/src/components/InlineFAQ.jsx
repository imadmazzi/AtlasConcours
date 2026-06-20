import React, { useState } from 'react';

/**
 * InlineFAQ — Contextual FAQ accordion for Concours/Job detail pages.
 *
 * Props:
 *   items  : Array<{ q: string, a: string }>  — list of Q&A pairs
 *   title  : string (optional) — section heading
 */
export default function InlineFAQ({ items = [], title = 'أسئلة شائعة حول هذا الإعلان' }) {
  const [openIdx, setOpenIdx] = useState(null);

  // Filter out any items with missing/empty answers
  const valid = items.filter(i => i.q && i.a);
  if (valid.length === 0) return null;

  const toggle = (i) => setOpenIdx(openIdx === i ? null : i);

  // Build FAQPage JSON-LD schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <div className="inline-faq-card card" style={{ marginTop: '28px' }}>
      {/* JSON-LD schema — injected once per component */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <h2 className="card-section-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
        <i className="fa fa-question-circle" style={{ color: 'var(--primary)', marginLeft: 10 }}></i>
        {title}
      </h2>

      <div className="inline-faq-list">
        {valid.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              className={`inline-faq-item${isOpen ? ' inline-faq-item--open' : ''}`}
            >
              <button
                className="inline-faq-question"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={`ifaq-${i}`}
                id={`ifaq-btn-${i}`}
              >
                <span className="inline-faq-q-text">{item.q}</span>
                <span className={`inline-faq-chevron${isOpen ? ' up' : ''}`}>
                  <i className="fa fa-chevron-down"></i>
                </span>
              </button>

              <div
                id={`ifaq-${i}`}
                role="region"
                aria-labelledby={`ifaq-btn-${i}`}
                className="inline-faq-answer"
                style={{ maxHeight: isOpen ? '600px' : '0' }}
              >
                <p className="inline-faq-answer-text" dir="rtl">{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Helpers used by both detail pages ─────────────────────────────── */

/**
 * Build a dynamic FAQ for a Concours object.
 * Reads the fields available in the API response.
 */
export function buildConcoursFAQ(concours, extracted = {}) {
  if (!concours) return [];
  const items = [];
  const titre = concours.titre || 'هذه المباراة';
  const deadline = concours.date_limite;
  const categorie = concours.categorie;

  // Q1 — How to apply
  items.push({
    q: `كيف يمكنني التسجيل في ${titre}؟`,
    a: `للتسجيل في ${titre}، انقر على زر "التسجيل الرسمي" أعلاه. سيتم توجيهك مباشرة إلى الصفحة الرسمية حيث يمكنك ملء استمارة الترشيح وتحميل الوثائق المطلوبة.`,
  });

  // Q2 — Deadline
  if (deadline && deadline !== 'N/A') {
    items.push({
      q: 'ما هو آخر أجل لتقديم الترشيح؟',
      a: `آخر أجل لتقديم الترشيح في هذا الإعلان هو ${deadline}. يُنصح بعدم الانتظار حتى اللحظة الأخيرة لتجنب أي مشكل تقني.`,
    });
  }

  // Q3 — Documents
  if (extracted.diplome) {
    items.push({
      q: 'ما هي الوثائق المطلوبة لهذه المباراة؟',
      a: `عادةً ما تتطلب هذه المباراة: نسخة من بطاقة التعريف الوطنية، شهادة ${extracted.diplome}، صور شمسية، وطلب الترشيح. تحقق من الإعلان الرسمي للقائمة الكاملة.`,
    });
  } else {
    items.push({
      q: 'ما هي الوثائق المطلوبة لهذه المباراة؟',
      a: 'تشمل الوثائق المطلوبة عادةً: نسخة من بطاقة التعريف الوطنية، الشواهد الدراسية، صور شمسية، وطلب الترشيح. يُرجى الرجوع إلى الإعلان الرسمي للتأكد من القائمة الكاملة للوثائق.',
    });
  }

  // Q4 — Posts available
  if (extracted.postes) {
    items.push({
      q: 'كم عدد المناصب المفتوحة في هذه المباراة؟',
      a: `تُفتح في هذه المباراة ${extracted.postes} منصب (منصباً). لمزيد من التفاصيل حول طبيعة المناصب وشروط الترشيح، راجع الإعلان الرسمي.`,
    });
  }

  // Q5 — Category
  if (categorie) {
    items.push({
      q: `هل يمكنني التسجيل إذا لم أكن من قطاع "${categorie}"؟`,
      a: `يحدد الإعلان الرسمي الشروط الدقيقة للترشيح. يُنصح بقراءة الإعلان بعناية قبل التقديم للتأكد من استيفاء جميع الشروط المتعلقة بقطاع "${categorie}".`,
    });
  }

  return items;
}

/**
 * Build a dynamic FAQ for a Job (Emploi) object.
 */
export function buildJobFAQ(job, extracted = {}) {
  if (!job) return [];
  const items = [];
  const titre = job.titre || 'هذه الوظيفة';
  const entreprise = job.entreprise || job.organisme;
  const localisation = job.localisation || job.ville;
  const deadline = job.date_limite || job.deadline;

  // Q1 — How to apply
  items.push({
    q: `كيف يمكنني التقدم لوظيفة "${titre}"؟`,
    a: `للتقدم لهذه الوظيفة، انقر على زر "الوظيفة الرسمية" أعلاه للانتقال مباشرة إلى صفحة التقديم الرسمية${entreprise ? ` لدى ${entreprise}` : ''}. قم بتحضير سيرتك الذاتية والوثائق المطلوبة مسبقاً.`,
  });

  // Q2 — Deadline
  if (deadline) {
    items.push({
      q: 'ما هو الموعد النهائي للتقديم؟',
      a: `الموعد النهائي للتقديم على هذا المنصب هو ${deadline}. لا تتأخر في تقديم ملفك لضمان معالجته في الوقت المناسب.`,
    });
  }

  // Q3 — Documents
  if (extracted.formation) {
    items.push({
      q: 'ما هي الوثائق والمؤهلات المطلوبة؟',
      a: `تتطلب هذه الوظيفة عادةً: سيرة ذاتية محدّثة، ${extracted.formation}، نسخة من بطاقة التعريف الوطنية، وخطاب تقديم (Cover Letter) إن طُلب. راجع الإعلان للتأكد.`,
    });
  } else {
    items.push({
      q: 'ما هي الوثائق المطلوبة للتقديم؟',
      a: 'يُطلب عادةً: سيرة ذاتية (CV) محدّثة، نسخة من بطاقة التعريف الوطنية، الشواهد الدراسية المناسبة، وخطاب تقديم. راجع الإعلان الرسمي للحصول على القائمة الكاملة.',
    });
  }

  // Q4 — Location
  if (localisation) {
    items.push({
      q: `أين يقع موقع العمل؟`,
      a: `موقع العمل هو ${localisation}${entreprise ? ` لدى ${entreprise}` : ''}. إذا كان الموقع بعيداً، تحقق مما إذا كانت الشركة أو الجهة توفر إمكانية العمل عن بُعد أو مزايا التنقل.`,
    });
  }

  // Q5 — Contract type
  if (extracted.contrat) {
    items.push({
      q: 'ما هو نوع عقد العمل المقدَّم؟',
      a: `نوع العقد المقدَّم في هذا الإعلان هو: ${extracted.contrat}. للاستفسار عن الشروط التفصيلية للعقد، يُنصح بالتواصل مباشرة مع الجهة المُعلِنة بعد التقديم.`,
    });
  }

  return items;
}
