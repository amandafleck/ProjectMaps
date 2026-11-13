// Ícones de traço, todos no mesmo estilo (herdam a cor do texto).
function Icon({ size = 18, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (props) => (
  <Icon {...props}>
    <path d="M5 12h14" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const PencilIcon = (props) => (
  <Icon {...props}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
  </Icon>
);

export const HomeIcon = (props) => (
  <Icon {...props}>
    <path d="M3.5 11.5L12 4l8.5 7.5" />
    <path d="M5.5 10v9.5h13V10" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16" />
    <path d="M9.5 7V4.5h5V7" />
    <path d="M6.5 7l.9 12a2 2 0 002 1.8h5.2a2 2 0 002-1.8l.9-12" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const ChevronIcon = (props) => (
  <Icon {...props}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const EyeIcon = (props) => (
  <Icon {...props}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Icon>
);

export const EyeOffIcon = (props) => (
  <Icon {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.7A9.8 9.8 0 0112 5.5c6.4 0 10 6.5 10 6.5a17 17 0 01-3.2 3.9M6.3 7.3A17 17 0 002 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8" />
    <path d="M9.9 9.9a2.6 2.6 0 003.7 3.7" />
  </Icon>
);

// dois pontos ligados por uma linha: traçar rota
export const RouteIcon = (props) => (
  <Icon {...props}>
    <circle cx="6" cy="18" r="2.6" />
    <circle cx="18" cy="6" r="2.6" />
    <path d="M8.2 16.6C12 14 8 10 15.8 7.4" strokeDasharray="2.2 2.6" />
  </Icon>
);

// versão em string para os marcadores do Leaflet (que usam HTML puro)
export const homeIconMarkup =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>';

export const ShareIcon = (props) => (
  <Icon {...props}>
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="6" r="2.6" />
    <circle cx="18" cy="18" r="2.6" />
    <path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" />
  </Icon>
);
