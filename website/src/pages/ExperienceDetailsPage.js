import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import ExperienceDetails from '../components/ExperienceDetails';
import { portfolioData } from '../data/portfolio';
import { LanguageContext } from '../context/LanguageContext';

const ExperienceDetailsPage = () => {
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  
  // Find experience by id
  const currentExpIndex = portfolioData.experiences.findIndex(e => e.id.toString() === experienceId);
  const experience = portfolioData.experiences[currentExpIndex];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [experienceId]);

  if (!experience) {
    return <Navigate to="/" replace />;
  }

  const handleBackClick = () => {
    navigate(language === 'en' ? '/' : `/${language}`);
  };

  const handlePrevious = () => {
    if (currentExpIndex > 0) {
      const prevExp = portfolioData.experiences[currentExpIndex - 1];
      navigate(language === 'en' ? `/experience/${prevExp.id}` : `/${language}/experience/${prevExp.id}`);
    }
  };

  const handleNext = () => {
    if (currentExpIndex < portfolioData.experiences.length - 1) {
      const nextExp = portfolioData.experiences[currentExpIndex + 1];
      navigate(language === 'en' ? `/experience/${nextExp.id}` : `/${language}/experience/${nextExp.id}`);
    }
  };

  return (
    <div className="flex-grow">
      <ExperienceDetails 
        experience={experience}
        onBackClick={handleBackClick}
        onPreviousClick={currentExpIndex > 0 ? handlePrevious : null}
        onNextClick={currentExpIndex < portfolioData.experiences.length - 1 ? handleNext : null}
      />
    </div>
  );
};

export default ExperienceDetailsPage;
