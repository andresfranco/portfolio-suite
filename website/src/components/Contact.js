import React, { useContext } from 'react';
import { FaGithub, FaLinkedin, FaXTwitter, FaEnvelope } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations';

const Contact = () => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);

  // Get editable section labels
  const getInTouchLabel = useSectionLabel('SECTION_GET_IN_TOUCH', 'get_in_touch');
  const githubLabel = useSectionLabel('SOCIAL_GITHUB', 'github');
  const linkedinLabel = useSectionLabel('SOCIAL_LINKEDIN', 'linkedin');
  const twitterLabel = useSectionLabel('SOCIAL_TWITTER', 'twitter');
  const contactFormLabel = useSectionLabel('LABEL_CONTACT_FORM', 'contact_form');

  // Use translation keys for labels
  const socialLinks = [
    { icon: FaGithub, href: 'https://github.com/yourusername', label: githubLabel },
    { icon: FaLinkedin, href: 'https://linkedin.com/in/yourusername', label: linkedinLabel },
    { icon: FaXTwitter, href: 'https://x.com/yourusername', label: twitterLabel },
    {
      icon: FaEnvelope,
      isRoute: true,
      path: '/contact',
      label: contactFormLabel
    },
  ];

  return (
    <main className="pt-20">
      <section id="contact" className="py-20 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            {getInTouchLabel.renderEditable('text-4xl font-bold text-white text-center mb-12')}
          </h2>
          <div className="flex justify-center items-center gap-8">
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              // Get the translated label
              const label = social.label.value;
              return social.isRoute ? (
                <button
                  key={index}
                  onClick={() => navigate(social.path)}
                  className="text-white/90 p-4 rounded-lg text-3xl transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                  aria-label={label}
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
                  aria-label={label}
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
