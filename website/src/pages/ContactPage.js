import React, { useState, useContext } from 'react'; // Import useContext
import { FaGithub, FaLinkedin, FaXTwitter } from 'react-icons/fa6'; // Removed FaEnvelope as it's handled by the Contact component
import { LanguageContext } from '../context/LanguageContext'; // Import LanguageContext
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations'; // Import translations

const ContactPage = () => {
  const { language } = useContext(LanguageContext); // Get language from context
  const t = translations[language]; // Get translations for the current language

  // Get editable section labels
  const getInTouchLabel = useSectionLabel('SECTION_GET_IN_TOUCH', 'get_in_touch');
  const descriptionLabel = useSectionLabel('LABEL_CONTACT_DESCRIPTION', 'contact_page_description');
  const connectLabel = useSectionLabel('LABEL_CONNECT_WITH_ME', 'connect_with_me');
  const nameLabel = useSectionLabel('FORM_NAME', 'name_label');
  const emailLabel = useSectionLabel('FORM_EMAIL', 'email_label');
  const subjectLabel = useSectionLabel('FORM_SUBJECT', 'subject_label');
  const messageLabel = useSectionLabel('FORM_MESSAGE', 'message_label');
  const sendButtonLabel = useSectionLabel('BTN_SEND_MESSAGE', 'send_message_button');
  const sendingLabel = useSectionLabel('BTN_SENDING', 'sending_button');
  const githubLabel = useSectionLabel('SOCIAL_GITHUB', 'github');
  const linkedinLabel = useSectionLabel('SOCIAL_LINKEDIN', 'linkedin');
  const twitterLabel = useSectionLabel('SOCIAL_TWITTER', 'twitter');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use translation keys for social links
  const socialLinks = [
    { icon: FaGithub, href: 'https://github.com/yourusername', label: githubLabel },
    { icon: FaLinkedin, href: 'https://linkedin.com/in/yourusername', label: linkedinLabel },
    { icon: FaXTwitter, href: 'https://x.com/yourusername', label: twitterLabel }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Add your email service integration here
    console.log('Form submitted:', formData);
    setIsSubmitting(false);
    // Optionally, clear the form or show a success message
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <main className="pt-20">
      <section className="py-20 bg-gray-900">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Use translation for the title */}
          <h2 className="text-4xl font-bold text-white text-center mb-8">
            {getInTouchLabel.renderEditable('text-4xl font-bold text-white text-center mb-8')}
          </h2>
          {/* Use translation for the description */}
          <div className="text-gray-300 text-center mb-12 text-lg">
            {descriptionLabel.renderEditable('text-gray-300 text-center mb-12 text-lg')}
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-6 mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {/* Use translation for the label */}
                <label htmlFor="name" className="block text-white mb-2">
                  {nameLabel.renderEditable('block text-white mb-2')}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700
                    focus:outline-none focus:border-[#14C800] transition-colors"
                />
              </div>
              <div>
                {/* Use translation for the label */}
                <label htmlFor="email" className="block text-white mb-2">
                  {emailLabel.renderEditable('block text-white mb-2')}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700
                    focus:outline-none focus:border-[#14C800] transition-colors"
                />
              </div>
            </div>
            <div>
              {/* Use translation for the label */}
              <label htmlFor="subject" className="block text-white mb-2">
                {subjectLabel.renderEditable('block text-white mb-2')}
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700
                  focus:outline-none focus:border-[#14C800] transition-colors"
              />
            </div>
            <div>
              {/* Use translation for the label */}
              <label htmlFor="message" className="block text-white mb-2">
                {messageLabel.renderEditable('block text-white mb-2')}
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows="6"
                value={formData.message}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700
                  focus:outline-none focus:border-[#14C800] transition-colors resize-none"
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#14C800] text-white px-8 py-3 rounded-lg
                transition-all duration-300 hover:bg-[#14C800]/90
                hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                transform hover:-translate-y-1 disabled:opacity-50"
            >
              {/* Use translation for the button text */}
              {isSubmitting ? sendingLabel.renderEditable() : sendButtonLabel.renderEditable()}
            </button>
          </form>

          {/* Social Links */}
          <div className="border-t border-gray-800 pt-12">
            {/* Use translation for the title */}
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {connectLabel.renderEditable('text-2xl font-bold text-white text-center mb-8')}
            </h3>
            <div className="flex justify-center items-center gap-8">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                // Get translated label for aria-label
                const label = social.label.value;
                return (
                  <a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 p-4 rounded-lg text-3xl
                      transition-all duration-300 hover:bg-[#14C800] hover:text-white
                      hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                      transform hover:-translate-y-1"
                    aria-label={label} // Use translated label
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;
