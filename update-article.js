require('dotenv').config();
const jwt = require('jsonwebtoken');

async function update() {
  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Fetch articles
  const res = await fetch('https://atlasconcours.vercel.app/api/articles?limit=50');
  const data = await res.json();
  const articles = data.data;

  const article = articles.find(a => a.titre.includes('CV'));
  if (!article) {
    console.log('Article non trouvé.');
    return;
  }

  const contenu = `
    <div class="article-content">
      <p>Le Curriculum Vitae (CV) est votre carte de visite professionnelle. Sur le marché du travail marocain, et particulièrement lors de vos postulations via l'ANAPEC (Agence Nationale de Promotion de l'Emploi et des Compétences), un CV bien structuré peut faire la différence entre une invitation à un entretien et un rejet automatique. Voici un guide complet pour optimiser votre CV.</p>

      <h3>1. La Structure et la Mise en Page</h3>
      <p>Un recruteur consacre en moyenne 6 secondes à la première lecture d'un CV. Votre document doit donc être clair, aéré et facile à lire.</p>
      <ul>
        <li><strong>Format :</strong> Privilégiez le format PDF pour éviter que la mise en page ne se décale.</li>
        <li><strong>Design :</strong> Optez pour un design sobre et moderne. Évitez les couleurs trop criardes ou les polices fantaisistes (utilisez Arial, Calibri ou Roboto).</li>
        <li><strong>Photo :</strong> Au Maroc, il est courant et souvent apprécié d'inclure une photo professionnelle. Assurez-vous qu'elle soit de bonne qualité, avec une tenue correcte (costume/chemise) et un fond neutre.</li>
        <li><strong>Longueur :</strong> Un CV d'une page est l'idéal pour les profils juniors. Les profils très expérimentés peuvent aller jusqu'à deux pages.</li>
      </ul>

      <h3>2. Les Sections Indispensables</h3>
      <p>Votre CV doit comporter des sections clairement identifiables :</p>
      
      <h4>A. En-tête et Coordonnées</h4>
      <p>Prénom, Nom, numéro de téléphone marocain, adresse e-mail professionnelle (<em>prenom.nom@email.com</em>), ville de résidence, et un lien vers votre profil LinkedIn si celui-ci est à jour.</p>

      <h4>B. Le Titre et l'Accroche</h4>
      <p>Ajoutez un titre explicite sous votre nom (ex: <em>Assistante de Direction trilingue</em> ou <em>Développeur Web Junior</em>). Suivez cela d'une courte phrase d'accroche (3-4 lignes) résumant votre profil, vos années d'expérience et votre objectif professionnel.</p>

      <h4>C. Expérience Professionnelle</h4>
      <p>Classez vos expériences par ordre anti-chronologique (de la plus récente à la plus ancienne). Pour chaque poste, précisez :</p>
      <ul>
        <li>Le titre du poste</li>
        <li>Le nom de l'entreprise et la ville</li>
        <li>Les dates de début et de fin</li>
        <li><strong>Vos missions et réalisations :</strong> Utilisez des puces et des verbes d'action. Quantifiez vos résultats si possible (ex: <em>Augmentation des ventes de 15%</em>).</li>
      </ul>

      <h4>D. Formation et Diplômes</h4>
      <p>Comme pour l'expérience, listez vos diplômes du plus récent au plus ancien. Mentionnez l'établissement, l'intitulé du diplôme, la spécialité, et l'année d'obtention. Pour les jeunes diplômés, cette section peut être placée avant l'expérience professionnelle.</p>

      <h4>E. Compétences (Hard Skills et Soft Skills)</h4>
      <p>Séparez vos compétences techniques (ex: <em>Maîtrise de SAP, Programmation Python, Comptabilité analytique</em>) de vos compétences comportementales (ex: <em>Esprit d'équipe, Gestion du stress, Communication</em>).</p>

      <h4>F. Langues et Informatique</h4>
      <p>Le marché marocain est souvent plurilingue. Précisez votre niveau en Arabe, Français et Anglais (Notions, Courant, Bilingue). Listez également les logiciels que vous maîtrisez.</p>

      <h3>3. Optimisation pour les filtres ATS et l'ANAPEC</h3>
      <p>De plus en plus de grandes entreprises au Maroc utilisent des ATS (Applicant Tracking Systems) pour trier les CV. Pour passer ce filtre :</p>
      <ul>
        <li><strong>Mots-clés :</strong> Utilisez les mots-clés exacts présents dans l'offre d'emploi à laquelle vous postulez.</li>
        <li><strong>Simplicité :</strong> Évitez les CV avec des jauges graphiques pour les compétences (les robots ne savent pas lire "4 étoiles sur 5"). Utilisez des mots (Débutant, Intermédiaire, Avancé).</li>
      </ul>
      <p><strong>Spécificité ANAPEC :</strong> Lors de votre inscription sur <a href="http://www.anapec.org" target="_blank">le portail de l'ANAPEC</a>, assurez-vous de remplir méticuleusement tous les champs du profil en ligne. Beaucoup de candidats se contentent d'uploader un PDF, mais les conseillers de l'ANAPEC utilisent souvent le moteur de recherche interne qui s'appuie sur les champs renseignés manuellement. Plus votre profil est complet, plus vous aurez de chances d'être contacté pour des offres d'emploi ou des formations qualifiantes.</p>

      <h3>Conclusion</h3>
      <p>Un CV n'est jamais figé. Il doit être adapté pour chaque offre d'emploi. Prenez le temps d'analyser les besoins de l'employeur et mettez en avant les expériences et compétences qui y répondent le mieux. Bonne chance dans votre recherche d'emploi !</p>
    </div>
  `;

  console.log('Mise à jour de article ID:', article.id);

  const putRes = await fetch(`https://atlasconcours.vercel.app/api/articles/${article.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      titre: "Comment rédiger un CV professionnel pour décrocher un emploi via l'ANAPEC",
      tags: article.tags || "Emploi, CV, ANAPEC",
      contenu
    })
  });

  console.log(await putRes.text());
}

update().catch(console.error);
