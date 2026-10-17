// ============================================================================
// FarmConnect AI — Central API & Regional Configuration
// ============================================================================

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  BLOCKCHAIN_RPC_URL: import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
  CHAIN_ID: 31337,
  TIMEOUT_MS: 8000,
  // Central flag: When true, API services fall back to isolated demonstration data
  // if backend endpoints are not reachable or return errors.
  USE_MOCK_FALLBACK: import.meta.env.VITE_ENABLE_MOCK_FALLBACKS !== 'false',
};

export const REGIONAL_METADATA = {
  DISTRICTS: ['Dakshina Kannada', 'Udupi'] as const,
  TALUKS_BY_DISTRICT: {
    'Dakshina Kannada': [
      'Bantwal',
      'Mangalore',
      'Puttur',
      'Belthangady',
      'Sullia',
      'Moodabidri',
      'Kadaba',
    ],
    'Udupi': [
      'Udupi',
      'Kundapura',
      'Karkala',
      'Brahmavar',
      'Kaup',
      'Byndoor',
      'Hebri',
    ],
  },
  POPULAR_CROPS: [
    { name: 'Arecanut', kannada: 'ಅಡಿಕೆ', category: 'plantation', defaultUnit: 'kg' },
    { name: 'Coconut', kannada: 'ತೆಂಗಿನಕಾಯಿ', category: 'plantation', defaultUnit: 'nuts' },
    { name: 'Black Pepper', kannada: 'ಕಾಳುಮೆಣಸು', category: 'spice', defaultUnit: 'kg' },
    { name: 'Udupi Mattu Gulla', kannada: 'ಮಟ್ಟುಗುಳ್ಳ ಬದನೆ', category: 'horticulture', defaultUnit: 'kg' },
    { name: 'Shankarpura Mallige', kannada: 'ಶಂಕರಪುರ ಮಲ್ಲಿಗೆ', category: 'horticulture', defaultUnit: 'atte' },
    { name: 'Cashew', kannada: 'ಗೇರು ಬೀಜ', category: 'plantation', defaultUnit: 'kg' },
    { name: 'Banana (Rasabale)', kannada: 'ರಸಬಾಳೆ ಹಣ್ಣು', category: 'fruit', defaultUnit: 'bunch' },
    { name: 'Coastal Red Rice', kannada: 'ಕರಾವಳಿ ಕುಚಲಕ್ಕಿ', category: 'cereal', defaultUnit: 'kg' },
  ],
  HUBS: [
    'Bantwal APMC Yard',
    'Mangalore Central Mandi',
    'Puttur Cooperative Hub',
    'Udupi Kissan Market Yard',
    'Kundapura Sub-Junction',
    'Karkala Agriculture Depot',
  ]
};
