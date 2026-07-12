export interface DiseaseInfo {
  commonName: string;
  plant: string;
  pathogen: string;
  pathogenType: string;
  symptoms: string[];
  treatments: { chemical: string[]; organic: string[]; prevention: string[] };
  severity: 'low' | 'moderate' | 'high' | 'critical';
  spreadRate: string;
}

export const DISEASE_KB: Record<string, DiseaseInfo> = {
  'Tomato___Early_blight': {
    commonName: 'Early Blight',
    plant: 'Tomato',
    pathogen: 'Alternaria solani',
    pathogenType: 'Fungus',
    symptoms: [
      'Dark brown circular spots with concentric rings (target-board pattern)',
      'Yellow halo surrounding each lesion',
      'Lower leaves affected first, progressing upward',
      'Premature leaf drop in severe cases',
    ],
    treatments: {
      chemical: ['Mancozeb 75% WP @ 2g/L water', 'Chlorothalonil 75% WP @ 2g/L water', 'Azoxystrobin 23% SC @ 1ml/L'],
      organic: ['Neem oil 5ml/L every 7–10 days', 'Copper-based Bordeaux mixture 1%', 'Trichoderma-based biocontrol spray'],
      prevention: ['3-year crop rotation', 'Remove infected debris immediately', 'Avoid overhead irrigation', 'Space plants for airflow'],
    },
    severity: 'moderate',
    spreadRate: 'fast',
  },
  'Tomato___Late_blight': {
    commonName: 'Late Blight',
    plant: 'Tomato',
    pathogen: 'Phytophthora infestans',
    pathogenType: 'Oomycete',
    symptoms: [
      'Water-soaked lesions on leaves turning dark brown/black',
      'White fuzzy mold on leaf undersides in humid conditions',
      'Rapid collapse of whole plant in cool, wet weather',
      'Brown rot on fruit',
    ],
    treatments: {
      chemical: ['Metalaxyl + Mancozeb 72% WP @ 2.5g/L', 'Cymoxanil 8% + Mancozeb 64% WP @ 2g/L'],
      organic: ['Copper oxychloride 50% WP @ 3g/L', 'Potassium bicarbonate solution'],
      prevention: ['Use resistant varieties', 'Avoid wetting foliage', 'Destroy infected plants immediately', 'Apply preventive fungicide in rainy season'],
    },
    severity: 'critical',
    spreadRate: 'very fast',
  },
  'Tomato___Leaf_Miner': {
    commonName: 'Leaf Miner',
    plant: 'Tomato',
    pathogen: 'Liriomyza trifolii',
    pathogenType: 'Pest',
    symptoms: [
      'Winding white/silvery tunnels on leaf surface',
      'Tiny yellow spots (feeding punctures)',
      'Blotchy mines on older infested leaves',
      'Reduced photosynthesis from mining damage',
    ],
    treatments: {
      chemical: ['Spinosad 45% SC @ 0.3ml/L', 'Abamectin 1.8% EC @ 0.5ml/L'],
      organic: ['Yellow sticky traps to monitor adults', 'Neem oil spray 5ml/L', 'Release parasitoid wasps (Diglyphus isaea)'],
      prevention: ['Remove and destroy infested leaves', 'Maintain field hygiene', 'Avoid excessive nitrogen fertilization'],
    },
    severity: 'moderate',
    spreadRate: 'moderate',
  },
  'Tomato___healthy': {
    commonName: 'Healthy Plant',
    plant: 'Tomato',
    pathogen: 'None',
    pathogenType: 'Healthy',
    symptoms: ['No disease symptoms detected', 'Leaves appear green and vigorous'],
    treatments: {
      chemical: [],
      organic: ['Continue regular balanced fertilization', 'Maintain consistent watering schedule'],
      prevention: ['Regular monitoring every 3-5 days', 'Preventive neem oil spray monthly', 'Maintain proper plant spacing'],
    },
    severity: 'low',
    spreadRate: 'slow',
  },
  'Pepper___bell___Bacterial_spot': {
    commonName: 'Bacterial Spot',
    plant: 'Bell Pepper',
    pathogen: 'Xanthomonas campestris',
    pathogenType: 'Bacteria',
    symptoms: [
      'Small, water-soaked spots on leaves turning brown with yellow halos',
      'Raised, scab-like lesions on fruit',
      'Defoliation in severe infections',
      'Greasy-looking spots in early stages',
    ],
    treatments: {
      chemical: ['Copper hydroxide 77% WP @ 3g/L', 'Streptomycin sulfate 90% SP @ 0.2g/L'],
      organic: ['Copper-based Bordeaux mixture 1%', 'Avoid overhead irrigation'],
      prevention: ['Use certified disease-free seed', 'Apply copper spray preventively', 'Avoid working in wet fields'],
    },
    severity: 'high',
    spreadRate: 'fast',
  },
  'Pepper___bell___healthy': {
    commonName: 'Healthy Plant',
    plant: 'Bell Pepper',
    pathogen: 'None',
    pathogenType: 'Healthy',
    symptoms: ['No disease symptoms detected'],
    treatments: {
      chemical: [],
      organic: ['Balanced NPK fertilization', 'Regular watering'],
      prevention: ['Weekly monitoring', 'Good air circulation'],
    },
    severity: 'low',
    spreadRate: 'slow',
  },
  'Potato___Early_blight': {
    commonName: 'Early Blight',
    plant: 'Potato',
    pathogen: 'Alternaria solani',
    pathogenType: 'Fungus',
    symptoms: [
      'Dark brown spots with concentric rings on older leaves',
      'Yellowing tissue surrounding spots',
      'Lesions on tubers causing dark, sunken cankers',
      'Severe defoliation reducing yield',
    ],
    treatments: {
      chemical: ['Mancozeb 75% WP @ 2g/L', 'Chlorothalonil 75% WP @ 2g/L', 'Difenoconazole 25% EC @ 0.5ml/L'],
      organic: ['Neem oil spray 5ml/L every 10 days', 'Trichoderma viride biocontrol'],
      prevention: ['Use certified seed potatoes', 'Crop rotation', 'Hilling to protect tubers'],
    },
    severity: 'moderate',
    spreadRate: 'moderate',
  },
  'Potato___Late_blight': {
    commonName: 'Late Blight',
    plant: 'Potato',
    pathogen: 'Phytophthora infestans',
    pathogenType: 'Oomycete',
    symptoms: [
      'Dark green to brown water-soaked lesions on leaf tips and margins',
      'White sporulation on leaf undersides in wet conditions',
      'Rapid blighting of entire plant',
      'Brown rot in tubers with unpleasant smell',
    ],
    treatments: {
      chemical: ['Metalaxyl + Mancozeb 72% WP @ 2.5g/L', 'Fenamidone + Mancozeb 66.75% WP @ 3g/L'],
      organic: ['Copper oxychloride 50% WP @ 3g/L'],
      prevention: ['Plant resistant varieties', 'Ensure good drainage', 'Destroy crop debris after harvest'],
    },
    severity: 'critical',
    spreadRate: 'very fast',
  },
  'Potato___healthy': {
    commonName: 'Healthy Plant',
    plant: 'Potato',
    pathogen: 'None',
    pathogenType: 'Healthy',
    symptoms: ['No disease detected'],
    treatments: {
      chemical: [],
      organic: ['Balanced fertilization', 'Regular soil testing'],
      prevention: ['Regular field scouting', 'Use certified seed tubers'],
    },
    severity: 'low',
    spreadRate: 'slow',
  },
  'Aloe_Vera___Rust': {
    commonName: 'Aloe Rust',
    plant: 'Aloe Vera',
    pathogen: 'Phakopsora pachyrhizi',
    pathogenType: 'Fungus',
    symptoms: [
      'Orange-yellow powdery pustules on leaves',
      'Yellowing and browning of affected tissue',
      'Premature leaf drop in severe cases',
      'Dark brown spots with orange spore masses',
    ],
    treatments: {
      chemical: ['Triadimefon 25% WP @ 1g/L', 'Propiconazole 25% EC @ 0.5ml/L'],
      organic: ['Neem oil spray 5ml/L', 'Remove and destroy affected leaves immediately'],
      prevention: ['Avoid overhead watering', 'Ensure good ventilation indoors', 'Do not overcrowd plants'],
    },
    severity: 'moderate',
    spreadRate: 'moderate',
  },
  'Money_Plant___Bacterial_Wilt': {
    commonName: 'Bacterial Wilt',
    plant: 'Money Plant',
    pathogen: 'Ralstonia solanacearum',
    pathogenType: 'Bacteria',
    symptoms: [
      'Sudden wilting of entire plant despite adequate watering',
      'Yellow-green discoloration of leaves',
      'Brown streaking inside stems when cut',
      'Milky bacterial ooze when stem placed in water',
    ],
    treatments: {
      chemical: ['Copper oxychloride soil drench @ 3g/L', 'Streptomycin sulfate spray @ 0.2g/L'],
      organic: ['Bacillus subtilis biocontrol soil application', 'Remove and discard infected plants completely'],
      prevention: ['Use sterile potting mix', 'Avoid overwatering', 'Disinfect tools between plants', 'Quarantine new plants'],
    },
    severity: 'critical',
    spreadRate: 'fast',
  },
  'Snake_Plant___Fungal_Leaf_Spot': {
    commonName: 'Fungal Leaf Spot',
    plant: 'Snake Plant',
    pathogen: 'Fusarium spp.',
    pathogenType: 'Fungus',
    symptoms: [
      'Tan to red-brown circular or irregular spots',
      'Yellow halo around spots',
      'Spots may merge into large lesions',
      'Wilting and rotting at base in advanced cases',
    ],
    treatments: {
      chemical: ['Mancozeb 75% WP @ 2g/L', 'Carbendazim 50% WP @ 1g/L'],
      organic: ['Neem oil 5ml/L spray', 'Cinnamon powder on cut surfaces', 'Remove badly affected leaves'],
      prevention: ['Water at base only', 'Allow soil to dry between waterings', 'Good drainage is essential'],
    },
    severity: 'moderate',
    spreadRate: 'slow',
  },
  'Rose___Black_spot': {
    commonName: 'Black Spot',
    plant: 'Rose',
    pathogen: 'Diplocarpon rosae',
    pathogenType: 'Fungus',
    symptoms: [
      'Circular black spots with fringed margins on upper leaf surface',
      'Yellow halo surrounding spots',
      'Severe defoliation starting from lower leaves',
      'Purple-red spots on young canes',
    ],
    treatments: {
      chemical: ['Myclobutanil 10% WP @ 1g/L', 'Tebuconazole 25% EC @ 0.5ml/L'],
      organic: ['Baking soda solution (1 tsp/L) weekly', 'Neem oil spray 5ml/L', 'Potassium bicarbonate spray'],
      prevention: ['Remove fallen infected leaves', 'Mulch around base', 'Water at ground level', 'Plant resistant varieties'],
    },
    severity: 'high',
    spreadRate: 'fast',
  },
  'Strawberry___Leaf_scorch': {
    commonName: 'Leaf Scorch',
    plant: 'Strawberry',
    pathogen: 'Diplocarpon earlianum',
    pathogenType: 'Fungus',
    symptoms: [
      'Small, irregular purple spots on upper leaf surface',
      'Spots expand with tan or white centers',
      'Leaf margins turn brown and die (scorch appearance)',
      'Reduced fruit size and runner production',
    ],
    treatments: {
      chemical: ['Captan 50% WP @ 3g/L', 'Myclobutanil 10% WP @ 1g/L'],
      organic: ['Neem oil spray 5ml/L', 'Remove old foliage after renovation'],
      prevention: ['Plant resistant varieties', 'Avoid overcrowding', 'Adequate air circulation', 'Renovation after harvest'],
    },
    severity: 'moderate',
    spreadRate: 'moderate',
  },
};

export function getDiseaseInfo(diseaseName: string): DiseaseInfo | null {
  // Exact match
  if (DISEASE_KB[diseaseName]) return DISEASE_KB[diseaseName];
  // Partial match
  const key = Object.keys(DISEASE_KB).find(
    (k) => k.toLowerCase().includes(diseaseName.toLowerCase()) ||
      diseaseName.toLowerCase().includes(k.toLowerCase().replace(/___/g, ' ').toLowerCase())
  );
  return key ? DISEASE_KB[key] : null;
}

export function formatDiseaseName(raw: string): string {
  return raw
    .replace(/___/g, ' — ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
