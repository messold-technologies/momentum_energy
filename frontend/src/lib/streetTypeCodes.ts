/**
 * AS 4590 site street type codes for servicedAddress.streetTypeCode
 */
export const STREET_TYPE_CODES = [
  'ACCS', 'ACRE', 'ALLY', 'ALWY', 'AMBL', 'ANCG', 'APP', 'ARC', 'ART', 'ARTL', 'AVE', 'BA', 'BASN', 'BAY', 'BCH',
  'BDGE', 'BDWY', 'BEND', 'BLK', 'BOWL', 'BRAE', 'BRAN', 'BRCE', 'BRET', 'BRK', 'BROW', 'BVD', 'BVDE', 'BWLK', 'BYPA',
  'CAUS', 'CCT', 'CDS', 'CH', 'CIR', 'CL', 'CLDE', 'CLR', 'CMMN', 'CNN', 'CNWY', 'CON', 'COVE', 'COWY', 'CPS', 'CRCS',
  'CRD', 'CRES', 'CRF', 'CRK', 'CRSE', 'CRSS', 'CRST', 'CSO', 'CT', 'CTR', 'CTTG', 'CTYD', 'CUT', 'DALE', 'DASH', 'DELL',
  'DEVN', 'DIP', 'DIV', 'DOCK', 'DR', 'DRWY', 'DWNS', 'EDGE', 'ELB', 'END', 'ENT', 'ESP', 'EST', 'EXP', 'EXTN', 'FAWY',
  'FBRK', 'FITR', 'FK', 'FLTS', 'FOLW', 'FORD', 'FORM', 'FRNT', 'FRTG', 'FSHR', 'FTWY', 'FWY', 'GAP', 'GATE', 'GDN', 'GDNS',
  'GLD', 'GLEN', 'GLY', 'GR', 'GRA', 'GRN', 'GRND', 'GTE', 'GTES', 'GTWY', 'HETH', 'HILL', 'HLLW', 'HRBR', 'HRD', 'HTS',
  'HUB', 'HVN', 'HWY', 'INLT', 'INTG', 'INTN', 'ISLD', 'JNC', 'KEY', 'KEYS', 'LADR', 'LANE', 'LEDR', 'LINE', 'LINK', 'LKT',
  'LNWY', 'LOOP', 'LWR', 'MALL', 'MANR', 'MART', 'MEAD', 'MEW', 'MEWS', 'MT', 'MWY', 'NOOK', 'NTH', 'OTLT', 'OVAL', 'PARK',
  'PART', 'PASS', 'PATH', 'PDE', 'PHWY', 'PKLD', 'PKT', 'PKWY', 'PL', 'PLAT', 'PLM', 'PLMS', 'PLZA', 'PNT', 'PORT', 'PRDS',
  'PREC', 'PROM', 'PRST', 'PSGE', 'PSLA', 'QDRT', 'QY', 'QYS', 'RAMP', 'RCH', 'RD', 'RDGE', 'RDS', 'RDWY', 'REEF', 'RES',
  'REST', 'RGWY', 'RIDE', 'RING', 'RISE', 'RMBL', 'RND', 'RNDE', 'RNGE', 'ROW', 'ROWY', 'RSNG', 'RTRN', 'RTT', 'RTY', 'RUE',
  'RUN', 'RVR', 'RVRA', 'SBWY', 'SDNG', 'SHWY', 'SKLN', 'SLPE', 'SND', 'SQ', 'ST', 'STPS', 'STRA', 'STRP', 'STRS', 'STRT',
  'SWY', 'TARN', 'TCE', 'THOR', 'TMWY', 'TOP', 'TOR', 'TRI', 'TRK', 'TRLR', 'TUNL', 'TURN', 'TVSE', 'UPAS', 'UPR', 'VALE',
  'VDCT', 'VIEW', 'VLGE', 'VLL', 'VLLY', 'VSTA', 'VUE', 'VWS', 'WALK', 'WAY',
] as const;

export type StreetTypeCode = (typeof STREET_TYPE_CODES)[number];
