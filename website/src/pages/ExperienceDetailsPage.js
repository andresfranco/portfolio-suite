import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import ExperienceDetails from '../components/ExperienceDetails';
import { usePortfolio } from '../context/PortfolioContext';
import { LanguageContext } from '../context/LanguageContext';

const ExperienceDetailsPage = () => {
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const { getExperiences, loading } = usePortfolio();
  
  // Get experiences from portfolio context
  const experiences = getExperiences();
  
  // Find experience by id
  const currentExpIndex = experiences.findIndex(e => e.id.toString() === experienceId);
  const experience = experiences[currentExpIndex];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [experienceId]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!experience) {
    return <Navigate to="/" replace />;
  }

  const handleBackClick = () => {
    navigate(language === 'en' ? '/' : `/${language}`);
  };

  const handlePrevious = () => {
    if (currentExpIndex > 0) {
      const prevExp = experiences[currentExpIndex - 1];
      navigate(language === 'en' ? `/experience/${prevExp.id}` : `/${language}/experience/${prevExp.id}`);
    }
  };

  const handleNext = () => {
    if (currentExpIndex < experiences.length - 1) {
      const nextExp = experiences[currentExpIndex + 1];
      navigate(language === 'en' ? `/experience/${nextExp.id}` : `/${language}/experience/${nextExp.id}`);
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
