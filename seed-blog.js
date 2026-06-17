require('dotenv').config();
const jwt = require('jsonwebtoken');

async function seed() {
  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const articles = [
    {
      titre: 'Comment bien se préparer au concours de l\'Enseignement au Maroc',
      tags: 'Enseignement, Préparation',
      contenu: '<div class="article-content"><p>Le concours de l\'enseignement est l\'un des plus prisés au Maroc. Pour réussir, une préparation rigoureuse s\'impose.</p><h3>1. Sciences de l\'éducation</h3><p>C\'est le pilier central. Familiarisez-vous avec les théories de l\'apprentissage (behaviorisme, constructivisme) et la psychologie de l\'enfant. Ne négligez pas les textes officiels comme la Charte Nationale d\'Éducation et de Formation.</p><h3>2. Didactique de la spécialité</h3><p>Chaque matière a sa propre didactique. Vous devez savoir comment planifier une leçon, définir des objectifs pédagogiques et évaluer les acquis. Entraînez-vous à rédiger des fiches pédagogiques complètes.</p><h3>3. L\'épreuve orale</h3><p>Le jury évaluera votre aisance, votre clarté d\'expression, et votre capacité à gérer des situations de classe complexes. Montrez-vous confiant et maîtrisez bien le tableau !</p></div>'
    },
    {
      titre: 'Guide complet pour réussir le concours de la Sûreté Nationale (Police)',
      tags: 'Police, Sécurité',
      contenu: '<div class="article-content"><p>La Direction Générale de la Sûreté Nationale (DGSN) recrute chaque année de nombreux profils. Voici comment vous démarquer.</p><h3>1. Les différents grades</h3><p>Gardiens de la paix (Bac), Inspecteurs (Bac+2), Officiers (Licence), et Commissaires (Master/Ingénieur). Choisissez le grade qui correspond exactement à votre diplôme.</p><h3>2. L\'épreuve écrite et le QCM</h3><p>La culture générale est primordiale. Lisez la presse marocaine, connaissez l\'histoire du Maroc, et ses institutions. Les questions à choix multiples (QCM) sont souvent très pointues et incluent des questions de droit et libertés publiques.</p><h3>3. Les tests physiques et psychologiques</h3><p>La condition physique est éliminatoire. Préparez-vous à courir (endurance) et aux épreuves de force. L\'entretien psychologique vise à tester votre sang-froid et votre intégrité.</p></div>'
    },
    {
      titre: 'Comment rédiger un CV professionnel pour décrocher un emploi via l\'ANAPEC',
      tags: 'Emploi, CV, ANAPEC',
      contenu: '<div class="article-content"><p>Votre CV est votre premier contact avec un recruteur de l\'ANAPEC. Il doit être irréprochable.</p><h3>1. La clarté avant tout</h3><p>Utilisez un design sobre et professionnel. Les recruteurs parcourent un CV en 6 secondes en moyenne. Vos compétences clés et votre expérience récente doivent sauter aux yeux.</p><h3>2. Optimisation pour les entreprises marocaines</h3><p>Indiquez clairement votre mobilité géographique, votre maîtrise des langues (Français/Anglais/Arabe) et incluez une photo professionnelle si demandée. Mettez en avant vos stages pratiques.</p><h3>3. L\'inscription sur le portail ANAPEC</h3><p>Ne vous contentez pas du CV papier. Complétez méticuleusement votre profil en ligne sur www.anapec.org. Plus votre profil est complet, plus vous remonterez dans les recherches des conseillers.</p></div>'
    },
    {
      titre: 'Les erreurs fatales à éviter lors de l\'inscription aux concours publics',
      tags: 'Concours, Conseils',
      contenu: '<div class="article-content"><p>De nombreuses candidatures sont rejetées avant même la correction des copies. Voici comment éviter les pièges administratifs.</p><h3>1. Légalisation et traduction des documents</h3><p>Vérifiez toujours si les copies certifiées conformes (légalisées) sont exigées. Si votre diplôme est étranger, l\'équivalence est strictement obligatoire. Ne fournissez jamais de documents traduits par un traducteur non assermenté.</p><h3>2. Gestion des fichiers PDF</h3><p>La majorité des inscriptions se font sur le portail <em>depot.emploi-public.ma</em>. La taille de vos fichiers PDF est limitée (souvent 1Mo par document). Apprenez à compresser vos PDF sans perdre en lisibilité, sinon le site rejettera votre upload.</p><h3>3. La gestion stricte des délais</h3><p>Le délai de rigueur est absolu (généralement à 16h30 le jour de la clôture). N\'attendez jamais le dernier jour, car les serveurs peuvent saturer face à l\'afflux des connexions.</p></div>'
    }
  ];

  for (const art of articles) {
    const res = await fetch('https://atlasconcours.vercel.app/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(art)
    });
    console.log(art.titre, await res.text());
  }
}

seed().catch(console.error);
