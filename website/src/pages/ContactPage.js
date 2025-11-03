import React, { useState, useContext, useEffect } from 'react'; // Import useContext
import { FaGithub, FaLinkedin, FaXTwitter, FaCircleCheck, FaCircleExclamation, FaGlobe, FaEnvelope } from 'react-icons/fa6'; // Removed FaEnvelope as it's handled by the Contact component
import * as FaIcons from 'react-icons/fa6';
import { useParams } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext'; // Import LanguageContext
import { usePortfolio } from '../context/PortfolioContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations'; // Import translations
import { portfolioApi } from '../services/portfolioApi'; // Import API service

const ContactPage = () => {
  const { lang } = useParams();
  const { language, setLanguage } = useContext(LanguageContext); // Get language from context
  const { portfolioData } = usePortfolio();
  const t = translations[language]; // Get translations for the current language
  const [portfolioLinks, setPortfolioLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);

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

  // Fetch portfolio links
  useEffect(() => {
    const fetchLinks = async () => {
      if (!portfolioData?.id) {
        setLinksLoading(false);
        return;
      }

      try {
        setLinksLoading(true);
        const response = await portfolioApi.getPortfolioLinks(portfolioData.id, true);
        setPortfolioLinks(response || []);
      } catch (error) {
        console.error('Error fetching portfolio links:', error);
        setPortfolioLinks([]);
      } finally {
        setLinksLoading(false);
      }
    };

    fetchLinks();
  }, [portfolioData?.id]);

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
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    subject: false,
    message: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null
  const [submitMessage, setSubmitMessage] = useState('');

  // Helper function to get icon component from icon name
  const getIconComponent = (iconName) => {
    if (!iconName) return FaGlobe;

    // Try to get the icon from FaIcons
    const IconComponent = FaIcons[iconName];
    return IconComponent || FaGlobe; // Fallback to globe icon
  };

  // Helper function to get link name in current language
  const getLinkName = (link) => {
    if (!link.link_texts || link.link_texts.length === 0) {
      return link.category?.texts?.[0]?.name || 'Link';
    }

    // Get language ID based on current language (1 = English, 2 = Spanish)
    const languageId = language === 'es' ? 2 : 1;

    // Find text for current language
    const text = link.link_texts.find(t => t.language_id === languageId);

    // Fallback to first available text or category name
    return text?.name || link.link_texts[0]?.name || link.category?.texts?.[0]?.name || 'Link';
  };

  // Build social links from database or use fallback
  const socialLinks = linksLoading ? [] : (
    portfolioLinks.length > 0
      ? portfolioLinks.map(link => ({
          icon: getIconComponent(link.category?.icon_name),
          href: link.url,
          label: getLinkName(link),
          ariaLabel: getLinkName(link)
        }))
      : [
          // Fallback to hardcoded links if no links in database
          { icon: FaGithub, href: 'https://github.com/yourusername', label: 'GitHub', ariaLabel: githubLabel.value },
          { icon: FaLinkedin, href: 'https://linkedin.com/in/yourusername', label: 'LinkedIn', ariaLabel: linkedinLabel.value },
          { icon: FaXTwitter, href: 'https://x.com/yourusername', label: 'Twitter', ariaLabel: twitterLabel.value }
        ]
  );

  // Validation function
  const validateField = (name, value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    switch (name) {
      case 'name':
        if (!value.trim()) {
          return t.validation_name_required;
        } else if (value.trim().length < 2) {
          return t.validation_name_min_length;
        }
        return '';

      case 'email':
        if (!value.trim()) {
          return t.validation_email_required;
        } else if (!emailRegex.test(value.trim())) {
          return t.validation_email_invalid;
        }
        return '';

      case 'subject':
        if (!value.trim()) {
          return t.validation_subject_required;
        } else if (value.trim().length < 3) {
          return t.validation_subject_min_length;
        }
        return '';

      case 'message':
        if (!value.trim()) {
          return t.validation_message_required;
        } else if (value.trim().length < 10) {
          return t.validation_message_min_length;
        }
        return '';

      default:
        return '';
    }
  };

  // Validate all fields
  const validateForm = () => {
    const newErrors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      subject: validateField('subject', formData.subject),
      message: validateField('message', formData.message)
    };

    setErrors(newErrors);

    // Mark all fields as touched
    setTouched({
      name: true,
      email: true,
      subject: true,
      message: true
    });

    // Return true if no errors
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);
    setSubmitMessage('');

    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the backend API to send the email
      const response = await portfolioApi.sendContactEmail(formData);

      // Show success message
      setSubmitStatus('success');
      setSubmitMessage(response.message || 'Your message has been sent successfully! I\'ll get back to you soon.');

      // Clear the form after successful submission
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });

      // Clear errors and touched state
      setErrors({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setTouched({
        name: false,
        email: false,
        subject: false,
        message: false
      });

      // Auto-hide success message after 8 seconds
      setTimeout(() => {
        setSubmitStatus(null);
        setSubmitMessage('');
      }, 8000);
    } catch (error) {
      // Show error message
      setSubmitStatus('error');
      setSubmitMessage(error.message || 'Failed to send your message. Please try again later or contact me directly.');

      // Auto-hide error message after 10 seconds
      setTimeout(() => {
        setSubmitStatus(null);
        setSubmitMessage('');
      }, 10000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error when user starts typing (if field was touched)
    if (touched[name]) {
      setErrors({ ...errors, [name]: validateField(name, value) });
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;

    // Mark field as touched
    setTouched({ ...touched, [name]: true });

    // Validate field
    setErrors({ ...errors, [name]: validateField(name, value) });
  };

  return (
    <main className="pt-20 bg-[#03060a] min-h-screen">
      <section className="relative py-20 bg-[#03060a] border-t border-white/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute -right-24 top-1/2 w-72 h-72 bg-[#14C800]/10 blur-3xl" />
          <div className="absolute -left-16 top-1/3 w-64 h-64 bg-blue-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto px-6 md:px-12 max-w-4xl">
          {/* Use translation for the title */}
          <h2 className="text-4xl font-bold text-white text-center mb-8">
            {getInTouchLabel.renderEditable('text-4xl font-bold text-white text-center mb-8')}
          </h2>
          {/* Use translation for the description */}
          <div className="text-gray-300 text-center mb-12 text-lg">
            {descriptionLabel.renderEditable('text-gray-300 text-center mb-12 text-lg')}
          </div>

          {/* Success/Error Message Display */}
          {submitStatus && (
            <div
              className={`mb-6 p-4 rounded-lg border transition-all duration-300 ${
                submitStatus === 'success'
                  ? 'bg-[#14C800]/10 border-[#14C800] text-[#14C800]'
                  : 'bg-red-500/10 border-red-500 text-red-400'
              }`}
            >
              <div className="flex items-start gap-3">
                {submitStatus === 'success' ? (
                  <FaCircleCheck className="text-2xl flex-shrink-0 mt-1" />
                ) : (
                  <FaCircleExclamation className="text-2xl flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h4 className="font-bold mb-1">
                    {submitStatus === 'success' ? 'Message Sent!' : 'Error Sending Message'}
                  </h4>
                  <p className="text-sm opacity-90">{submitMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-6 mb-16" noValidate>
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
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-none bg-white/10 text-white border transition-all duration-200 focus:outline-none ${
                    touched.name && errors.name
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-white/10 focus:border-[#14C800]'
                  }`}
                  aria-invalid={touched.name && errors.name ? 'true' : 'false'}
                  aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                />
                {touched.name && errors.name && (
                  <p id="name-error" className="mt-2 text-sm text-red-400 flex items-center gap-1 animate-fadeIn">
                    <FaCircleExclamation className="flex-shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
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
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-none bg-white/10 text-white border transition-all duration-200 focus:outline-none ${
                    touched.email && errors.email
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-white/10 focus:border-[#14C800]'
                  }`}
                  aria-invalid={touched.email && errors.email ? 'true' : 'false'}
                  aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                />
                {touched.email && errors.email && (
                  <p id="email-error" className="mt-2 text-sm text-red-400 flex items-center gap-1 animate-fadeIn">
                    <FaCircleExclamation className="flex-shrink-0" />
                    <span>{errors.email}</span>
                  </p>
                )}
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
                value={formData.subject}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 rounded-none bg-white/10 text-white border transition-all duration-200 focus:outline-none ${
                  touched.subject && errors.subject
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-white/10 focus:border-[#14C800]'
                }`}
                aria-invalid={touched.subject && errors.subject ? 'true' : 'false'}
                aria-describedby={touched.subject && errors.subject ? 'subject-error' : undefined}
              />
              {touched.subject && errors.subject && (
                <p id="subject-error" className="mt-2 text-sm text-red-400 flex items-center gap-1 animate-fadeIn">
                  <FaCircleExclamation className="flex-shrink-0" />
                  <span>{errors.subject}</span>
                </p>
              )}
            </div>
            <div>
              {/* Use translation for the label */}
              <label htmlFor="message" className="block text-white mb-2">
                {messageLabel.renderEditable('block text-white mb-2')}
              </label>
              <textarea
                id="message"
                name="message"
                rows="6"
                value={formData.message}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 rounded-none bg-white/10 text-white border transition-all duration-200 focus:outline-none resize-none ${
                  touched.message && errors.message
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-white/10 focus:border-[#14C800]'
                }`}
                aria-invalid={touched.message && errors.message ? 'true' : 'false'}
                aria-describedby={touched.message && errors.message ? 'message-error' : undefined}
              ></textarea>
              {touched.message && errors.message && (
                <p id="message-error" className="mt-2 text-sm text-red-400 flex items-center gap-1 animate-fadeIn">
                  <FaCircleExclamation className="flex-shrink-0" />
                  <span>{errors.message}</span>
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-flat btn-flat-lg disabled:cursor-not-allowed"
            >
              {/* Use translation for the button text */}
              {isSubmitting ? sendingLabel.renderEditable() : sendButtonLabel.renderEditable()}
            </button>
          </form>

          {/* Social Links */}
          <div className="border-t border-white/10 pt-12">
            {/* Use translation for the title */}
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {connectLabel.renderEditable('text-2xl font-bold text-white text-center mb-8')}
            </h3>
            <div className="flex justify-center items-center gap-8 flex-wrap">
              {linksLoading ? (
                <p className="text-white/70">Loading links...</p>
              ) : socialLinks.length > 0 ? (
                socialLinks.map((social, index) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={index}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-flat btn-flat-icon"
                      aria-label={social.ariaLabel || social.label}
                    >
                      <Icon />
                    </a>
                  );
                })
              ) : (
                <p className="text-white/70">No social links available</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;
