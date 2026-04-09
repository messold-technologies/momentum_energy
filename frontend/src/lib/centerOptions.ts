
export const CENTER_OPTIONS = [
  'Utility hub India',
  'Utility hub India- Uhub SA',
  'Utility hub SA',
  'Utility hub Fiji',
  'Utility hub Fiji – Uhub India',
  'Utility hub Fiji – Uhub SA',
  'Er Solutions',
  'Er Solutions – Uhub India',
  'Er Solutions– Uhub SA',
  'Connect IQ',
  'Connect IQ– Uhub India',
  'Connect IQ– Uhub SA',
  'T4U– Uhub India',
  'T4U– Uhub SA',
  'CoSauce SA',
  'CoSauce SA– Uhub India',
  'CoSauce SA– Uhub SA',
  'Real Estate',
  'Real Estate– Uhub India',
  'Real Estate– Uhub SA',
] as const;

export type CenterOption = (typeof CENTER_OPTIONS)[number];
