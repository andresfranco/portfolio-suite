import React from 'react';
import './HeroSection.css';

const HeroSection = () => {
  return (
    <div className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">Welcome to Portfolio AI</h1>
        <p className="hero-subtitle">Your AI-powered portfolio assistant</p>
        <button className="cta-button">Get Started</button>
      </div>
      <div className="hero-image">
        {/* Add your hero image or icon here */}
      </div>
    </div>
  );
};

export default HeroSection;
