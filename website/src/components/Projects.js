import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';
import ProjectDetails from './ProjectDetails';

const ProjectModal = ({ project, onClose, onViewDetails, language }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-4xl rounded-xl overflow-hidden max-h-[90vh]">
        <div className="border-b border-gray-800 p-4 flex justify-between items-center">
          <h3 className="text-white text-xl md:text-2xl font-bold">
            {project.title[language]}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label={translations[language].close}
          >
            ✕
          </button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto">
          <img 
            src={project.image} 
            alt={project.title[language]}
            className="w-full h-48 md:h-64 object-cover rounded-lg mb-4 md:mb-6"
          />
          <p className="text-gray-300 text-base md:text-lg mb-6">
            {project.description[language]}
          </p>
          <button
            onClick={onViewDetails}
            className="inline-block bg-[#14C800] text-white px-6 py-3 rounded-lg
              transition-all duration-300 hover:bg-[#14C800]/90 
              hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
              transform hover:-translate-y-1 text-base md:text-lg"
          >
            {translations[language].view_full_details}
          </button>
        </div>
      </div>
    </div>
  );
};

const Projects = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);

  const projects = [
    {
      id: 1,
      title: { en: "E-commerce Platform", es: "Plataforma de Comercio Electrónico" },
      image: require('../assets/images/project1.jpg'),
      description: { en: "A comprehensive e-commerce platform with a user-friendly interface and secure payment gateway.", es: "Una plataforma de comercio electrónico integral con una interfaz fácil de usar y una pasarela de pago segura." },
      brief: { en: "Next-generation e-commerce solution built with modern web technologies.", es: "Solución de comercio electrónico de próxima generación construida con tecnologías web modernas." },
      date: "January 2024",
      category: { en: "Web Development", es: "Desarrollo Web" },
      liveUrl: "https://example.com",
      repoUrl: "https://github.com/username/project"
    },
    {
      id: 2,
      title: { en: "Mobile Application", es: "Aplicación Móvil" },
      image: require('../assets/images/project2.jpg'),
      description: { en: "A mobile application designed to enhance user experience with intuitive navigation and seamless performance.", es: "Una aplicación móvil diseñada para mejorar la experiencia del usuario con una navegación intuitiva y un rendimiento fluido." },
      link: "#"
    },
    {
      id: 3,
      title: { en: "Digital Marketing Campaign", es: "Campaña de Marketing Digital" },
      image: require('../assets/images/project3.jpg'),
      description: { en: "A digital marketing campaign that leverages social media and SEO strategies to boost brand visibility.", es: "Una campaña de marketing digital que aprovecha las estrategias de redes sociales y SEO para aumentar la visibilidad de la marca." },
      link: "#"
    }
  ];

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleViewDetails = (projectId) => {
    setShowModal(false);
    const route = language === 'en' ? `/projects/${projectId}` : `/${language}/projects/${projectId}`;
    navigate(route);
  };

  return (
    <div className="flex-grow">
      <main className="pt-20">
        <section className="py-20 bg-gray-800">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-8 text-white">
              {translations[language].projects}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="relative group cursor-pointer rounded-xl overflow-hidden
                    transition-all duration-300
                    hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                    transform hover:-translate-y-1
                    aspect-[4/3]"
                >
                  <img
                    src={project.image}
                    alt={project.title[language]}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/75 md:bg-black/40 
                    md:opacity-0 md:group-hover:opacity-100
                    md:group-hover:bg-black/85 transition-all duration-300 
                    flex items-center justify-center">
                    <h3 className="text-white text-xl md:text-2xl font-bold text-center px-4
                      md:opacity-0 md:group-hover:opacity-100 transform 
                      transition-all duration-300
                      md:translate-y-4 md:group-hover:translate-y-0">
                      {project.title[language]}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {showModal && selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setShowModal(false)}
          onViewDetails={() => handleViewDetails(selectedProject.id)}
          language={language}
        />
      )}
    </div>
  );
};

export default Projects;
