require('dotenv').config();
const db = require('./db');
const slugify = require('slugify');

console.log('🌱 Initialisation des données de démonstration...');

// Vider les tables (sauf users)
db.exec('DELETE FROM concours; DELETE FROM emplois; DELETE FROM articles;');

// =====================
// CONCOURS
// =====================
const concoursData = [
  {
    titre: 'Concours de Recrutement de la Police Nationale 2026',
    description: `<h2>Présentation du Concours</h2><p>La Direction Générale de la Sûreté Nationale (DGSN) annonce l'ouverture d'un concours de recrutement pour les postes d'agents de police de la Sûreté Nationale pour l'année 2026.</p><h2>Conditions de Participation</h2><ul><li>Nationalité marocaine</li><li>Âgé(e) de 18 à 25 ans</li><li>Baccalauréat ou équivalent</li><li>Bonne condition physique</li><li>Casier judiciaire vierge</li></ul><h2>Pièces à Fournir</h2><ul><li>Formulaire de candidature dûment rempli</li><li>Copie de la CIN</li><li>Copies certifiées des diplômes</li><li>Certificat de résidence</li><li>Extrait de naissance</li></ul>`,
    categorie: 'Sécurité',
    date_limite: '2026-06-30',
    lien_source: 'https://www.dgsn.ma'
  },
  {
    titre: 'Concours d\'Accès à l\'École Nationale d\'Administration 2026',
    description: `<h2>L'École Nationale d'Administration (ENA)</h2><p>L'ENA ouvre ses portes aux candidats souhaitant intégrer la haute fonction publique marocaine. Ce concours prestigieux forme les futurs hauts cadres de l'administration marocaine.</p><h2>Spécialités proposées</h2><ul><li>Administration Générale</li><li>Finances Publiques</li><li>Diplomatie et Relations Internationales</li><li>Affaires Juridiques</li></ul><h2>Conditions requises</h2><ul><li>Diplôme Bac+4 minimum</li><li>Âge maximum: 35 ans</li><li>Maîtrise du français et de l'arabe</li></ul>`,
    categorie: 'Administration',
    date_limite: '2026-07-15',
    lien_source: 'https://www.ena.ma'
  },
  {
    titre: 'Concours de Recrutement des Enseignants — Ministère de l\'Éducation 2026',
    description: `<h2>Recrutement Enseignants 2026</h2><p>Le Ministère de l'Éducation Nationale annonce l'ouverture d'un concours national pour le recrutement de 20 000 enseignants tous niveaux confondus.</p><h2>Niveaux concernés</h2><ul><li>Enseignement primaire</li><li>Enseignement collégial</li><li>Enseignement lycéen</li></ul><h2>Matières disponibles</h2><p>Mathématiques, Physique-Chimie, SVT, Français, Arabe, Histoire-Géographie, Éducation Islamique, Anglais, Espagnol.</p>`,
    categorie: 'Éducation',
    date_limite: '2026-06-15',
    lien_source: 'https://www.men.gov.ma'
  },
  {
    titre: 'Concours d\'Entrée aux Grandes Écoles d\'Ingénieurs — CPGE 2026',
    description: `<h2>Concours National Commun</h2><p>Le Concours National Commun (CNC) permet aux élèves des Classes Préparatoires aux Grandes Écoles d'intégrer les meilleures écoles d'ingénieurs du Maroc.</p><h2>Écoles partenaires</h2><ul><li>École Mohammadia d'Ingénieurs (EMI)</li><li>ENSIAS</li><li>ENSA de plusieurs villes</li><li>INPT</li></ul>`,
    categorie: 'Ingénierie',
    date_limite: '2026-05-30',
    lien_source: 'https://cnc.ac.ma'
  },
  {
    titre: 'Concours Gendarmerie Royale — Sous-Officiers 2026',
    description: `<h2>Recrutement Gendarmerie Royale</h2><p>La Gendarmerie Royale du Maroc ouvre un concours de recrutement de sous-officiers pour l'année 2026. Ce concours vise à renforcer les effectifs des unités de la Gendarmerie Royale.</p><h2>Profils recherchés</h2><ul><li>Techniciens en informatique</li><li>Techniciens en télécommunications</li><li>Agents administratifs</li><li>Techniciens en génie civil</li></ul>`,
    categorie: 'Sécurité',
    date_limite: '2026-07-01',
    lien_source: 'https://www.gendarmerie.ma'
  },
  {
    titre: 'Concours de Recrutement au Ministère de la Santé — Infirmiers 2026',
    description: `<h2>Ministère de la Santé et de la Protection Sociale</h2><p>Le Ministère de la Santé et de la Protection Sociale lance un concours de recrutement de 5 000 infirmiers et techniciens de santé pour renforcer le système de santé marocain.</p><h2>Spécialités concernées</h2><ul><li>Infirmier polyvalent</li><li>Sage-femme</li><li>Technicien de radiologie</li><li>Technicien de laboratoire</li><li>Kinésithérapeute</li></ul>`,
    categorie: 'Santé',
    date_limite: '2026-06-20',
    lien_source: 'https://www.sante.gov.ma'
  },
  {
    titre: 'Concours d\'Accès au Corps des Magistrats — CSPJ 2026',
    description: `<h2>Conseil Supérieur du Pouvoir Judiciaire</h2><p>Le CSPJ annonce l'ouverture d'un concours de recrutement de magistrats pour le compte du Ministère de la Justice. Ce concours vise à intégrer des juristes de haut niveau dans le corps de la magistrature marocaine.</p><h2>Conditions requises</h2><ul><li>Licence en droit ou équivalent</li><li>Âge maximum: 40 ans</li><li>Excellente moralité</li></ul>`,
    categorie: 'Justice',
    date_limite: '2026-08-01',
    lien_source: 'https://www.justice.gov.ma'
  },
  {
    titre: 'Concours de Recrutement — Office National de l\'Électricité et de l\'Eau (ONEE) 2026',
    description: `<h2>ONEE Branche Eau</h2><p>L'Office National de l'Électricité et de l'Eau (ONEE) organise un concours de recrutement pour intégrer des ingénieurs, techniciens et cadres administratifs dans ses différentes directions régionales.</p><h2>Postes disponibles</h2><ul><li>Ingénieurs en Génie Civil (20 postes)</li><li>Ingénieurs en Électricité (15 postes)</li><li>Techniciens supérieurs (30 postes)</li><li>Agents d'exploitation (50 postes)</li></ul>`,
    categorie: 'Entreprises Publiques',
    date_limite: '2026-06-25',
    lien_source: 'https://www.one.org.ma'
  }
];

const insertConcours = db.prepare(
  'INSERT INTO concours (titre, slug, description, categorie, date_limite, lien_source, vues) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

concoursData.forEach((c, i) => {
  const slug = slugify(c.titre, { lower: true, strict: true, locale: 'fr' }) + '-2026';
  insertConcours.run(c.titre, slug, c.description, c.categorie, c.date_limite, c.lien_source, Math.floor(Math.random() * 5000) + 100);
});

console.log(`✅ ${concoursData.length} concours créés`);

// =====================
// EMPLOIS
// =====================
const emploisData = [
  {
    titre: 'Développeur Full Stack JavaScript',
    entreprise: 'Capgemini Maroc',
    localisation: 'Casablanca',
    description: 'Nous recherchons un développeur Full Stack JS expérimenté (React/Node.js) pour rejoindre nos équipes à Casablanca. CDI, salaire compétitif. 3+ ans d\'expérience requis.',
    lien_candidature: '#'
  },
  {
    titre: 'Ingénieur DevOps — Cloud AWS',
    entreprise: 'OCP Group',
    localisation: 'Rabat',
    description: 'L\'OCP Group recrute un Ingénieur DevOps spécialisé AWS pour accompagner sa transformation digitale. Expérience Kubernetes, Terraform et CI/CD requise.',
    lien_candidature: '#'
  },
  {
    titre: 'Chargé de Communication Digitale',
    entreprise: 'Maroc Telecom',
    localisation: 'Rabat',
    description: 'Maroc Telecom recrute un(e) Chargé(e) de Communication Digitale pour gérer les réseaux sociaux, créer du contenu et analyser les performances digitales.',
    lien_candidature: '#'
  },
  {
    titre: 'Analyste Financier Senior',
    entreprise: 'Attijariwafa Bank',
    localisation: 'Casablanca',
    description: 'Attijariwafa Bank recherche un Analyste Financier Senior pour son département de gestion des risques. Master en Finance requis, 5+ ans d\'expérience.',
    lien_candidature: '#'
  },
  {
    titre: 'Responsable Ressources Humaines',
    entreprise: 'Renault Group Maroc',
    localisation: 'Tanger',
    description: 'Renault Group Maroc recrute un(e) RRH pour son site de production à Tanger. Gestion des relations sociales, paie et développement RH.',
    lien_candidature: '#'
  },
  {
    titre: 'Chef de Projet IT',
    entreprise: 'HPS Worldwide',
    localisation: 'Casablanca',
    description: 'HPS Worldwide, leader en solutions de paiement, recrute un Chef de Projet IT pour piloter des projets d\'intégration de systèmes de paiement internationaux.',
    lien_candidature: '#'
  }
];

const insertEmploi = db.prepare(
  'INSERT INTO emplois (titre, entreprise, localisation, description, lien_candidature) VALUES (?, ?, ?, ?, ?)'
);

emploisData.forEach(e => insertEmploi.run(e.titre, e.entreprise, e.localisation, e.description, e.lien_candidature));
console.log(`✅ ${emploisData.length} offres d'emploi créées`);

// =====================
// ARTICLES
// =====================
const articlesData = [
  {
    titre: 'Comment Rédiger un CV Parfait pour les Concours Publics au Maroc',
    contenu: `<h2>Introduction</h2><p>La rédaction d'un CV pour les concours publics au Maroc est une étape cruciale qui peut déterminer votre succès dans le processus de sélection. Contrairement aux CV pour le secteur privé, les CV pour les concours publics doivent respecter certaines conventions spécifiques.</p>
<h2>1. La Structure du CV pour Concours Public</h2>
<p>Un CV pour concours public marocain doit être clair, concis et structuré. Voici les sections essentielles :</p>
<ul>
<li><strong>Informations personnelles</strong> : Nom, prénom, CIN, date de naissance, adresse, téléphone</li>
<li><strong>Objectif professionnel</strong> : 2-3 lignes ciblant le poste visé</li>
<li><strong>Formation académique</strong> : Du plus récent au plus ancien</li>
<li><strong>Expériences professionnelles</strong> : Stage, emplois précédents</li>
<li><strong>Compétences</strong> : Langues, informatique, compétences techniques</li>
</ul>
<h2>2. Les Erreurs à Éviter</h2>
<p>Les candidats commettent souvent les erreurs suivantes :</p>
<ul>
<li>CV trop long (plus de 2 pages)</li>
<li>Fautes d'orthographe</li>
<li>Informations non pertinentes</li>
<li>Photo non professionnelle</li>
</ul>
<h2>3. Conseils pour Se Démarquer</h2>
<p>Pour maximiser vos chances, adaptez votre CV à chaque concours. Mettez en avant les compétences spécifiques demandées dans l'avis de concours et utilisez des mots-clés pertinents.</p>`,
    tags: 'CV,Conseil,Concours'
  },
  {
    titre: 'Guide Complet de Préparation aux Concours de la Fonction Publique 2026',
    contenu: `<h2>Pourquoi Préparer les Concours de la Fonction Publique ?</h2><p>Intégrer la fonction publique marocaine offre de nombreux avantages : stabilité de l'emploi, avantages sociaux, retraite garantie et possibilités d'évolution de carrière. Cependant, la compétition est rude et une préparation sérieuse est indispensable.</p>
<h2>1. Comprendre le Format des Épreuves</h2>
<p>Les concours de la fonction publique au Maroc comportent généralement :</p>
<ul>
<li><strong>Épreuve écrite</strong> : Culture générale, droit administratif, finances publiques</li>
<li><strong>Épreuve technique</strong> : Selon la spécialité du poste</li>
<li><strong>Épreuve orale</strong> : Entretien avec le jury</li>
</ul>
<h2>2. Plan de Révision Efficace</h2>
<p>Nous recommandons un plan de révision sur 3 mois :</p>
<ul>
<li><strong>Mois 1</strong> : Culture générale + droit constitutionnel marocain</li>
<li><strong>Mois 2</strong> : Droit administratif + finances publiques</li>
<li><strong>Mois 3</strong> : Révisions + annales des concours précédents</li>
</ul>`,
    tags: 'Préparation,Concours,Fonction Publique'
  },
  {
    titre: 'Les 10 Questions Pièges des Entretiens d\'Embauche au Maroc',
    contenu: `<h2>Réussir son Entretien d'Embauche au Maroc</h2><p>L'entretien d'embauche est souvent l'étape la plus redoutée du processus de recrutement. Pourtant, avec une bonne préparation, vous pouvez transformer cette épreuve en opportunité de vous démarquer.</p>
<h2>Les 10 Questions Incontournables</h2>
<ol>
<li><strong>"Parlez-moi de vous"</strong> : Préparez un pitch de 2 minutes structuré (formation → expérience → objectifs)</li>
<li><strong>"Pourquoi voulez-vous ce poste ?"</strong> : Montrez que vous avez fait des recherches sur l'organisation</li>
<li><strong>"Quelles sont vos qualités et défauts ?"</strong> : Soyez honnête mais stratégique</li>
<li><strong>"Où vous voyez-vous dans 5 ans ?"</strong> : Montrez votre ambition alignée avec les objectifs du poste</li>
<li><strong>"Pourquoi quittez-vous votre poste actuel ?"</strong> : Restez professionnel et positif</li>
</ol>`,
    tags: 'Entretien,Emploi,Conseil Carrière'
  },
  {
    titre: 'Droit Administratif Marocain : Les Bases pour Réussir les Concours',
    contenu: `<h2>Introduction au Droit Administratif Marocain</h2><p>Le droit administratif constitue une matière fondamentale dans la plupart des concours de la fonction publique marocaine. Maîtriser ses principes de base est essentiel pour réussir les épreuves écrites.</p>
<h2>1. Les Fondements Constitutionnels</h2>
<p>La Constitution de 2011 constitue le socle du droit administratif marocain. Elle consacre le principe de légalité, l'État de droit et la séparation des pouvoirs.</p>
<h2>2. Les Actes Administratifs</h2>
<ul>
<li><strong>Décrets</strong> : Actes réglementaires du Roi et du Chef du Gouvernement</li>
<li><strong>Arrêtés</strong> : Actes des ministres et autorités locales</li>
<li><strong>Décisions</strong> : Actes individuels des autorités administratives</li>
</ul>`,
    tags: 'Droit,Concours,Révision'
  },
  {
    titre: 'Comment Obtenir une Bourse d\'Études à l\'Étranger depuis le Maroc',
    contenu: `<h2>Les Opportunités de Bourses pour les Marocains</h2><p>Chaque année, des milliers de Marocains obtiennent des bourses d'études à l'étranger. Ces opportunités permettent d'accéder à une formation de qualité internationale tout en bénéficiant d'un soutien financier.</p>
<h2>Les Principales Bourses Disponibles</h2>
<ul>
<li><strong>Bourses du gouvernement français</strong> (Campus France Maroc)</li>
<li><strong>Bourses Fulbright</strong> (États-Unis)</li>
<li><strong>Erasmus+</strong> (Union Européenne)</li>
<li><strong>DAAD</strong> (Allemagne)</li>
<li><strong>Bourses du gouvernement marocain</strong> (Agence Marocaine de Coopération)</li>
</ul>`,
    tags: 'Bourse,Études,International'
  }
];

const insertArticle = db.prepare(
  'INSERT INTO articles (titre, slug, contenu, tags, vues) VALUES (?, ?, ?, ?, ?)'
);

articlesData.forEach((a, i) => {
  const slug = slugify(a.titre, { lower: true, strict: true, locale: 'fr' }) + '-' + (2026 + i);
  insertArticle.run(a.titre, slug, a.contenu, a.tags, Math.floor(Math.random() * 3000) + 50);
});

console.log(`✅ ${articlesData.length} articles créés`);
console.log('\n🎉 Données de démonstration initialisées avec succès !');
console.log('📧 Admin: admin@atlasconcours.ma | 🔑 Mot de passe: Admin2026!');
