import React, { useContext, useState, useMemo, useCallback } from 'react';
import { FaEnvelope, FaPen, FaPlus } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { usePortfolioLinks } from '../hooks/usePortfolioLinks';
import ContactLinksEditor from './ContactLinksEditor';
import ContactLinkCreateDialog from './ContactLinkCreateDialog';
import { getIconComponent } from '../utils/iconUtils';
import { getLinkDisplayName, sortLinksByOrder } from '../utils/linkDisplay';

const Contact = () => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const { portfolio: portfolioData } = usePortfolio();
  const { isEditMode, authToken } = useEditMode();

  // Get editable section label
  const getInTouchLabel = useSectionLabel('SECTION_GET_IN_TOUCH', 'get_in_touch');

  // Fetch portfolio links from database
  const {
    links: portfolioLinks,
    loading: linksLoading,
    refresh: refreshPortfolioLinks
  } = usePortfolioLinks({
    portfolioId: portfolioData?.id,
    isEditMode,
    authToken
  });

  // State for editor UI
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Sort and filter active links
  const sortedActiveLinks = useMemo(() => {
    const active = (portfolioLinks || []).filter((link) => link.is_active);
    return sortLinksByOrder(active);
  }, [portfolioLinks]);

  // Build social links from database
  const socialLinks = useMemo(() => {
    return sortedActiveLinks.map((link) => {
      const label = getLinkDisplayName(link, language);
      const isRoute = Boolean(link.is_route);

      return {
        icon: getIconComponent(link?.category?.icon_name),
        href: isRoute ? undefined : link.url,
        path: isRoute ? link.url : undefined,
        label,
        ariaLabel: label,
        isRoute
      };
    });
  }, [sortedActiveLinks, language]);

  // Handler functions for edit mode
  const handleToggleEditor = useCallback(() => {
    setIsEditorOpen((prev) => !prev);
  }, []);

  const handleAddLinkClick = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    setIsCreateDialogOpen(false);
  }, []);

  const handleLinkCreated = useCallback(() => {
    refreshPortfolioLinks();
    setIsCreateDialogOpen(false);
  }, [refreshPortfolioLinks]);

  return (
    <>
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

          {/* Edit Mode Controls */}
          {isEditMode && portfolioData?.id && (
            <div className="mb-8 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleToggleEditor}
                className="inline-flex items-center gap-2 rounded-lg border border-[#14C800]/40 bg-[#14C800]/10 px-4 py-2 text-sm font-medium text-[#14C800] transition hover:bg-[#14C800]/20"
              >
                <FaPen />
                {isEditorOpen ? 'Close Editor' : 'Edit Links'}
              </button>
              <button
                type="button"
                onClick={handleAddLinkClick}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
                disabled={!portfolioData?.id}
              >
                <FaPlus />
                Add Link
              </button>
            </div>
          )}

          {/* Social Links Display */}
          <div className="flex justify-center items-center gap-8 flex-wrap">
            {linksLoading ? (
              <p className="text-white/70">Loading links...</p>
            ) : socialLinks.length > 0 ? (
              socialLinks.map((social, index) => {
                const Icon = social.icon;
                const label = social.label;
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
                    className={`btn-flat btn-flat-icon ${
                      isEditMode ? 'pointer-events-none' : ''
                    }`}
                    aria-label={label}
                    title={label}
                    onClick={isEditMode ? (event) => event.preventDefault() : undefined}
                  >
                    <Icon />
                  </a>
                );
              })
            ) : (
              <p className="text-white/70">No social links available</p>
            )}
          </div>

          {/* Contact Links Editor */}
          {isEditMode && isEditorOpen && portfolioData?.id && (
            <div className="mt-12">
              <ContactLinksEditor
                portfolioId={portfolioData.id}
                links={portfolioLinks}
                onRefresh={refreshPortfolioLinks}
              />
            </div>
          )}
        </div>
      </section>

      {/* Contact Link Create Dialog */}
      <ContactLinkCreateDialog
        isOpen={isEditMode && isCreateDialogOpen && Boolean(portfolioData?.id)}
        onClose={handleCloseCreateDialog}
        portfolioId={portfolioData?.id}
        onCreated={handleLinkCreated}
      />
    </>
  );
};

export default Contact;
