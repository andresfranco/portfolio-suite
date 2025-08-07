import React, { useState, useContext } from 'react'; // Import useContext
import { FaGithub, FaLinkedin, FaXTwitter } from 'react-icons/fa6'; // Removed FaEnvelope as it's handled by the Contact component
import { LanguageContext } from '../context/LanguageContext'; // Import LanguageContext
import { translations } from '../data/translations'; // Import translations

const ContactPage = () => {
  const { language } = useContext(LanguageContext); // Get language from context
  const t = translations[language]; // Get translations for the current language

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use translation keys for social links
  const socialLinks = [
    { icon: FaGithub, href: 'https://github.com/yourusername', labelKey: 'github' },
    { icon: FaLinkedin, href: 'https://linkedin.com/in/yourusername', labelKey: 'linkedin' },
    { icon: FaXTwitter, href: 'https://x.com/yourusername', labelKey: 'twitter' }
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
            {t.get_in_touch}
          </h2>
          {/* Use translation for the description */}
          <p className="text-gray-300 text-center mb-12 text-lg">
            {t.contact_page_description}
          </p>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-6 mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {/* Use translation for the label */}
                <label htmlFor="name" className="block text-white mb-2">{t.name_label}</label>
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
                <label htmlFor="email" className="block text-white mb-2">{t.email_label}</label>
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
              <label htmlFor="subject" className="block text-white mb-2">{t.subject_label}</label>
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
              <label htmlFor="message" className="block text-white mb-2">{t.message_label}</label>
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
              {isSubmitting ? t.sending_button : t.send_message_button}
            </button>
          </form>

          {/* Social Links */}
          <div className="border-t border-gray-800 pt-12">
            {/* Use translation for the title */}
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {t.connect_with_me}
            </h3>
            <div className="flex justify-center items-center gap-8">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                // Get translated label for aria-label
                const label = t[social.labelKey];
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
