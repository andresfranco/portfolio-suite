import { projectsData } from './projects';

export const portfolioData = {
  person: {
    name: "Andres Franco",
    title: "Data & Integration Architect",
    tagline: "Transforming data into actionable insights with cutting-edge technology and creative solutions.",
    resume: "/resume.pdf",
    socialLinks: {
      github: "https://github.com/yourusername",
      linkedin: "https://linkedin.com/in/yourusername",
      twitter: "https://x.com/yourusername"
    }
  },
  languages: ["English", "Spanish"],
  experiences: [
    {
      id: 1,
      icon: 'code',
      area: { en: "Development", es: "Desarrollo" },
      years: 8,
      description: {
        en: "Enterprise Solutions & APIs",
        es: "Soluciones empresariales y APIs"
      },
      skills: [
        {
          name: { en: "Mulesoft Development", es: "Desarrollo Mulesoft" },
          level: "Advanced"
        },
        {
          name: { en: "API Design", es: "Diseño de APIs" },
          level: "Expert"
        },
        {
          name: { en: "Integration Patterns", es: "Patrones de Integración" },
          level: "Advanced"
        }
      ]
    },
    {
      id: 2,
      icon: 'database',
      area: { en: "Data Architecture", es: "Arquitectura de Datos" },
      years: 6,
      description: {
        en: "Integration & Analytics",
        es: "Integración y análisis"
      },
      skills: [
        {
          name: { en: "Data Modeling", es: "Modelado de Datos" },
          level: "Expert"
        },
        {
          name: { en: "SQL & NoSQL", es: "SQL y NoSQL" },
          level: "Advanced"
        },
        {
          name: { en: "ETL Processes", es: "Procesos ETL" },
          level: "Advanced"
        }
      ]
    },
    {
      id: 3,
      icon: 'cloud',
      area: { en: "Cloud Solutions", es: "Soluciones en la Nube" },
      years: 5,
      description: {
        en: "AWS & Azure Platforms",
        es: "Plataformas AWS y Azure"
      },
      skills: [
        {
          name: { en: "AWS Services", es: "Servicios AWS" },
          level: "Advanced"
        },
        {
          name: { en: "Azure Platform", es: "Plataforma Azure" },
          level: "Advanced"
        },
        {
          name: { en: "Cloud Architecture", es: "Arquitectura Cloud" },
          level: "Expert"
        }
      ]
    }
  ],
  projects: [
    {
      id: 1,
      title: { en: "E-commerce Platform", es: "Plataforma de Comercio Electrónico" },
      image: "/assets/images/project1.jpg",
      description: {
        en: "A comprehensive e-commerce platform with a user-friendly interface and secure payment gateway.",
        es: "Una plataforma de comercio electrónico integral, con una interfaz intuitiva y una pasarela de pago segura."
      },
      brief: {
        en: "Next-generation e-commerce solution built with modern web technologies.",
        es: "Solución de comercio electrónico de próxima generación desarrollada con tecnologías web modernas."
      },
      date: "January 2024",
      category: { en: "Web Development", es: "Desarrollo Web" },
      liveUrl: "https://example.com",
      repoUrl: "https://github.com/username/project",
      skills: [
        {
          name: { en: "Mulesoft Development", es: "Desarrollo Mulesoft" },
          description: {
            en: "Develop enterprise APIs using Mulesoft.",
            es: "Desarrolla APIs empresariales utilizando Mulesoft."
          }
        },
        {
          name: { en: "Python", es: "Python" },
          description: {
            en: "Data processing and scripting.",
            es: "Procesamiento de datos y scripting."
          }
        },
        {
          name: { en: "Data Modeling", es: "Modelado de Datos" },
          description: {
            en: "Design robust database schemas.",
            es: "Diseña esquemas robustos para bases de datos."
          }
        },
        {
          name: { en: "Data Architecture", es: "Arquitectura de Datos" },
          description: {
            en: "Define data flow and integration patterns.",
            es: "Define flujos de datos y patrones de integración."
          }
        },
        {
          name: { en: "Salesforce Development", es: "Desarrollo Salesforce" },
          description: {
            en: "Customize and extend the Salesforce platform.",
            es: "Personaliza y amplía la plataforma Salesforce."
          }
        },
        {
          name: { en: "Data Integrations", es: "Integración de Datos" },
          description: {
            en: "Integrate multiple data sources seamlessly.",
            es: "Integra múltiples fuentes de datos sin problemas."
          }
        }
      ]
    },
    {
      id: 2,
      title: { en: "Mobile Application", es: "Aplicación Móvil" },
      image: "/assets/images/project2.jpg",
      description: {
        en: "A mobile application designed to enhance user experience with intuitive navigation and seamless performance.",
        es: "Una aplicación móvil diseñada para mejorar la experiencia del usuario con una navegación intuitiva y un rendimiento sin problemas."
      },
      brief: {
        en: "Mobile app built with React Native and Firebase.",
        es: "Aplicación móvil construida con React Native y Firebase."
      },
      date: "February 2024",
      category: { en: "Mobile Development", es: "Desarrollo Móvil" },
      liveUrl: "https://example.com",
      repoUrl: "",
      skills: [
        {
          name: { en: "React Native", es: "React Native" },
          description: {
            en: "Build cross-platform mobile applications.",
            es: "Construye aplicaciones móviles multiplataforma."
          }
        },
        {
          name: { en: "Firebase", es: "Firebase" },
          description: {
            en: "Integrate backend services with Firebase.",
            es: "Integra servicios backend con Firebase."
          }
        },
        {
          name: { en: "Data Modeling", es: "Modelado de Datos" },
          description: {
            en: "Efficiently design data structures.",
            es: "Diseña estructuras de datos de manera eficiente."
          }
        },
        {
          name: { en: "API Integration", es: "Integración de API" },
          description: {
            en: "Seamlessly integrate RESTful APIs.",
            es: "Integra APIs RESTful sin problemas."
          }
        }
      ]
    },
    {
      id: 3,
      title: { en: "Digital Marketing Campaign", es: "Campaña de Marketing Digital" },
      image: "/assets/images/project3.jpg",
      description: {
        en: "A digital marketing campaign that leverages social media and SEO strategies to boost brand visibility.",
        es: "Una campaña de marketing digital que aprovecha las estrategias de redes sociales y SEO para aumentar la visibilidad de la marca."
      },
      brief: {
        en: "Digital marketing campaign for a startup.",
        es: "Campaña de marketing digital para una startup."
      },
      date: "March 2024",
      category: { en: "Marketing", es: "Marketing" },
      liveUrl: "https://example.com",
      repoUrl: "",
      skills: [
        {
          name: { en: "Data Analytics", es: "Análisis de Datos" },
          description: {
            en: "Analyze campaign data to extract actionable insights.",
            es: "Analiza los datos de la campaña para extraer información accionable."
          }
        },
        {
          name: { en: "SEO Optimization", es: "Optimización SEO" },
          description: {
            en: "Improve search engine rankings and site visibility.",
            es: "Mejora el ranking en motores de búsqueda y la visibilidad del sitio."
          }
        },
        {
          name: { en: "Social Media Integration", es: "Integración de Redes Sociales" },
          description: {
            en: "Connect and engage via social channels.",
            es: "Conecta y participa a través de canales sociales."
          }
        },
        {
          name: { en: "Marketing Automation", es: "Automatización de Marketing" },
          description: {
            en: "Automate repetitive marketing tasks.",
            es: "Automatiza tareas de marketing repetitivas."
          }
        }
      ]
    }
  ]
};

export default portfolioData;
