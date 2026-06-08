export const TIER_COLOR = {
  Severe:      '#e8453c',
  Constrained: '#e8a020',
  'Low Need':  '#3fb950',
  Benchmark:   '#388bfd',
};

export const TIER_DIM = {
  Severe:      'rgba(232,69,60,.13)',
  Constrained: 'rgba(232,160,32,.13)',
  'Low Need':  'rgba(63,185,80,.13)',
  Benchmark:   'rgba(56,139,253,.13)',
};

export const TIER_FILL = {
  Severe:      '#e8453cbb',
  Constrained: '#e8a020bb',
  'Low Need':  '#3fb950bb',
  Benchmark:   '#388bfdbb',
};

export const tierColor = (t) => TIER_COLOR[t] || '#484f58';
export const fmt1      = (v) => v != null ? (+v).toFixed(1) : '—';
export const fmtV      = (v) => {
  if (v == null) return '—';
  const n = +v;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
};

// ISO-3 → numeric-id lookup (TopoJSON uses numeric IDs)
export const ISO3_TO_NUM = {
  AFG:'004',ALB:'008',DZA:'012',AGO:'024',ATG:'028',AUS:'036',AUT:'040',
  BGD:'050',BEL:'056',BTN:'064',BOL:'068',BRA:'076',BLZ:'084',SLB:'090',
  BRN:'096',BGR:'100',MMR:'104',BDI:'108',CMR:'120',CAN:'124',CPV:'132',
  CAF:'140',LKA:'144',TCD:'148',CHL:'152',CHN:'156',COL:'170',COM:'174',
  COG:'178',COD:'180',CRI:'188',HRV:'191',CYP:'196',CZE:'203',BEN:'204',
  DNK:'208',DOM:'214',ECU:'218',SLV:'222',ETH:'231',ERI:'232',EST:'233',
  FJI:'242',FRA:'250',DJI:'262',GAB:'266',GEO:'268',GMB:'270',DEU:'276',
  GHA:'288',GRC:'300',GRD:'308',GTM:'320',GIN:'324',HTI:'332',HND:'340',
  HUN:'348',IND:'356',IDN:'360',IRN:'364',IRQ:'368',IRL:'372',ISR:'376',
  ITA:'380',CIV:'384',JAM:'388',JPN:'392',KAZ:'398',JOR:'400',KEN:'404',
  PRK:'408',KOR:'410',KWT:'414',KGZ:'417',LAO:'418',LBN:'422',LSO:'426',
  LVA:'428',LBR:'430',LBY:'434',LTU:'440',MWI:'454',MYS:'458',MDV:'462',
  MLI:'466',MLT:'470',MRT:'478',MUS:'480',MEX:'484',MNG:'496',MDA:'498',
  MAR:'504',MOZ:'508',NAM:'516',NPL:'524',NLD:'528',VUT:'548',NZL:'554',
  NGA:'566',NOR:'578',PAK:'586',PAN:'591',PNG:'598',PRY:'600',PER:'604',
  PHL:'608',POL:'616',PRT:'620',GNB:'624',TLS:'626',QAT:'634',ROU:'642',
  RUS:'643',RWA:'646',SAU:'682',SEN:'686',SLE:'694',SGP:'702',SVK:'703',
  VNM:'704',SVN:'705',SOM:'706',ZAF:'710',ZWE:'716',ESP:'724',SSD:'728',
  SDN:'729',SUR:'740',SWZ:'748',SWE:'752',CHE:'756',SYR:'760',TJK:'762',
  THA:'764',TGO:'768',TTO:'780',TUN:'788',TUR:'792',TKM:'795',UGA:'800',
  UKR:'804',EGY:'818',GBR:'826',TZA:'834',USA:'840',BFA:'854',URY:'858',
  UZB:'860',VEN:'862',WSM:'882',YEM:'887',ZMB:'894',
};