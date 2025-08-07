import React, { useContext } from 'react';
import { FaGithub, FaLinkedin, FaXTwitter, FaEnvelope } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';

const Contact = () => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);

  // Use translation keys for labels
  const socialLinks = [
    { icon: FaGithub, href: 'https://github.com/yourusername', labelKey: 'github' },
    { icon: FaLinkedin, href: 'https://linkedin.com/in/yourusername', labelKey: 'linkedin' },
    { icon: FaXTwitter, href: 'https://x.com/yourusername', labelKey: 'twitter' },
    {
      icon: FaEnvelope,
      isRoute: true,
      path: '/contact',
      labelKey: 'contact_form' // Use a key for the Contact Form label
    },
  ];

  return (
    <main className="pt-20">
      <section id="contact" className="py-20 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            {translations[language].get_in_touch}
          </h2>
          <div className="flex justify-center items-center gap-8">
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              // Get the translated label
              const label = translations[language][social.labelKey];
              return social.isRoute ? (
                <button
                  key={index}
                  onClick={() => navigate(social.path)}
                  className="text-white/90 p-4 rounded-lg text-3xl transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                  aria-label={label} // Use translated label
                >
                  <Icon />
                </button>
              ) : (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 p-4 rounded-lg text-3xl transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                  aria-label={label} // Use translated label
                >
                  <Icon />
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
