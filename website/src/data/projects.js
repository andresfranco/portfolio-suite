import project1 from '../assets/images/project1.jpg';
import project2 from '../assets/images/project2.jpg';
import project3 from '../assets/images/project3.jpg';

// Define skills with translations that can be reused across projects
const skillsData = {
  react: {
    name: { en: "React", es: "React" },
    level: "Advanced"
  },
  node: {
    name: { en: "Node.js", es: "Node.js" },
    level: "Advanced"
  },
  typescript: {
    name: { en: "TypeScript", es: "TypeScript" },
    level: "Advanced"
  },
  mongodb: {
    name: { en: "MongoDB", es: "MongoDB" },
    level: "Intermediate"
  },
  aws: {
    name: { en: "AWS", es: "AWS" },
    level: "Intermediate"
  },
  docker: {
    name: { en: "Docker", es: "Docker" },
    level: "Intermediate"
  },
  flutter: {
    name: { en: "Flutter", es: "Flutter" },
    level: "Advanced"
  },
  firebase: {
    name: { en: "Firebase", es: "Firebase" },
    level: "Advanced"
  },
  googleAnalytics: {
    name: { en: "Google Analytics", es: "Google Analytics" },
    level: "Intermediate"
  },
  seo: {
    name: { en: "SEO", es: "SEO" },
    level: "Advanced"
  }
};

export const projectsData = [
  {
    id: 1,
    title: { 
      en: "E-commerce Platform", 
      es: "Plataforma de Comercio Electrónico" 
    },
    image: project1,
    description: { 
      en: "A comprehensive e-commerce platform with a user-friendly interface and secure payment gateway.", 
      es: "Una plataforma de comercio electrónico integral con una interfaz fácil de usar y una pasarela de pago segura." 
    },
    brief: { 
      en: "Next-generation e-commerce solution built with modern web technologies.", 
      es: "Solución de comercio electrónico de próxima generación construida con tecnologías web modernas." 
    },
    date: {
      en: "January 2024",
      es: "Enero 2024"
    },
    category: { 
      en: "Web Development", 
      es: "Desarrollo Web" 
    },
    skills: [
      skillsData.react,
      skillsData.node,
      skillsData.typescript,
      skillsData.mongodb,
      skillsData.aws,
      skillsData.docker
    ],
    liveUrl: "https://example.com",
    repoUrl: "https://github.com/username/project"
  },
  {
    id: 2,
    title: { 
      en: "Mobile Application", 
      es: "Aplicación Móvil" 
    },
    image: project2,
    description: { 
      en: "A mobile application designed to enhance user experience with intuitive navigation and seamless performance.", 
      es: "Una aplicación móvil diseñada para mejorar la experiencia del usuario con una navegación intuitiva y un rendimiento fluido." 
    },
    date: {
      en: "February 2024",
      es: "Febrero 2024"
    },
    skills: [
      skillsData.flutter,
      skillsData.firebase
    ],
    link: "#"
  },
  {
    id: 3,
    title: { 
      en: "Digital Marketing Campaign", 
      es: "Campaña de Marketing Digital" 
    },
    image: project3,
    description: { 
      en: "A digital marketing campaign that leverages social media and SEO strategies to boost brand visibility.", 
      es: "Una campaña de marketing digital que aprovecha las estrategias de redes sociales y SEO para aumentar la visibilidad de la marca." 
    },
    date: {
      en: "March 2024",
      es: "Marzo 2024"
    },
    skills: [
      skillsData.googleAnalytics,
      skillsData.seo
    ],
    link: "#"
  }
];
