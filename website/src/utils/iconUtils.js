import * as FaIcons from 'react-icons/fa6';
import * as SiIcons from 'react-icons/si';

const ICON_LIBRARIES = [
  { prefix: 'Fa', icons: FaIcons },
  { prefix: 'Si', icons: SiIcons }
];

const FALLBACK_ICON_NAME = 'FaGlobe';
const FALLBACK_ICON = FaIcons[FALLBACK_ICON_NAME] || (() => null);

const POPULAR_ICON_NAMES = [
  'FaGlobe',
  'FaGithub',
  'FaLinkedin',
  'FaXTwitter',
  'FaInstagram',
  'FaFacebook',
  'FaYoutube',
  'FaTiktok',
  'FaDiscord',
  'FaSlack',
  'FaStackOverflow',
  'FaCodeBranch',
  'FaLaptopCode',
  'FaBriefcase',
  'FaEnvelope',
  'FaPhone',
  'FaWhatsapp',
  'FaTelegram',
  'FaMedium',
  'FaDev',
  'FaBehance',
  'FaDribbble',
  'FaReddit',
  'FaBlogger',
  'FaCodepen',
  'FaGlobe',
  'SiHashnode'
];

const resolveIcon = (iconName) => {
  if (!iconName) {
    return { Icon: FALLBACK_ICON, name: FALLBACK_ICON_NAME };
  }

  for (const { icons } of ICON_LIBRARIES) {
    if (iconName in icons) {
      return { Icon: icons[iconName], name: iconName };
    }
  }

  return null;
};

export const getIconComponent = (iconName) => {
  const resolved = resolveIcon(iconName);
  return resolved?.Icon || FALLBACK_ICON;
};

export const getIconDisplayName = (iconName) => {
  if (!iconName) {
    return 'Globe';
  }

  return iconName
    .replace(/^(Fa|Si)/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\bX Twitter\b/i, 'X (Twitter)');
};

export const getIconOptions = (additionalNames = []) => {
  const names = new Set([
    ...POPULAR_ICON_NAMES,
    ...additionalNames.filter(Boolean)
  ]);

  return Array.from(names)
    .map((name) => {
      const resolved = resolveIcon(name);
      if (!resolved) {
        return null;
      }

      return {
        value: resolved.name,
        label: getIconDisplayName(resolved.name),
        Icon: resolved.Icon
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const iconHasComponent = (iconName) => Boolean(resolveIcon(iconName));

export const fallbackIconName = FALLBACK_ICON_NAME;
