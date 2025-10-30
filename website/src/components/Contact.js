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
    <section id="contact" className="relative py-20 bg-[#03060a] border-t border-white/10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="absolute -right-24 top-1/2 w-72 h-72 bg-[#14C800]/10 blur-3xl" />
        <div className="absolute -left-20 top-1/3 w-60 h-60 bg-blue-500/10 blur-3xl" />
      </div>
      <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center">
        <h2 className="text-4xl font-bold text-white mb-12">
          {getInTouchLabel.renderEditable('text-4xl font-bold text-white text-center mb-12')}
        </h2>
        <div className="flex justify-center items-center gap-8 flex-wrap">
          {socialLinks.map((social, index) => {
            const Icon = social.icon;
            // Get the translated label
            const label = social.label.value;
            return social.isRoute ? (
              <button
                key={index}
                onClick={() => navigate(social.path)}
                className="btn-flat btn-flat-icon"
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
                className="btn-flat btn-flat-icon"
                aria-label={label}
              >
                <Icon />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Contact;
