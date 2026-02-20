import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExperienceDetails from '../components/ExperienceDetails';
import { usePortfolio } from '../context/PortfolioContext';
import { LanguageContext } from '../context/LanguageContext';

const ExperienceDetailsPage = () => {
  const { experienceId, lang } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage } = useContext(LanguageContext);
  const { getExperiences, loading } = usePortfolio();

  // Get experiences from portfolio context
  const experiences = getExperiences();

  // Find experience by id
  const currentExpIndex = experiences.findIndex(e => e.id.toString() === experienceId);
  const experience = experiences[currentExpIndex];

  // Sync language from URL prefix when present
  useEffect(() => {
    if (!lang) {
      return;
    }

    const supportedLanguages = ['en', 'es'];
    const normalizedLang = supportedLanguages.includes(lang) ? lang : 'en';

    if (normalizedLang !== language) {
      setLanguage(normalizedLang);
    }
  }, [lang, language, setLanguage]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [experienceId]);

  // Show loading state during data fetch
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // If experience is not found, show loading (don't redirect immediately)
  // This handles the case where portfolio data is being reloaded
  if (!experience) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  const handleBackClick = () => {
    navigate('/');
  };

  const handlePrevious = () => {
    if (currentExpIndex > 0) {
      const prevExp = experiences[currentExpIndex - 1];
      navigate(`/experience/${prevExp.id}`);
    }
  };

  const handleNext = () => {
    if (currentExpIndex < experiences.length - 1) {
      const nextExp = experiences[currentExpIndex + 1];
      navigate(`/experience/${nextExp.id}`);
    }
  };

  return (
    <div className="flex-grow">
      <ExperienceDetails 
        experience={experience}
        onBackClick={handleBackClick}
        onPreviousClick={currentExpIndex > 0 ? handlePrevious : null}
        onNextClick={currentExpIndex < experiences.length - 1 ? handleNext : null}
      />
    </div>
  );
};

export default ExperienceDetailsPage;
