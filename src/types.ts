export type Language = 'vi' | 'en';

export type ScenarioId = 'medical' | 'cardio' | 'allergy' | 'admin';

export interface GestureStep {
  id: string;
  gloss: string;
  glossEn: string;
  confidence: number;
  nmmMarker: string; // Non-manual marker
  nmmMarkerEn: string;
  handPoseDesc: string;
  handPoseDescEn: string;
}

export interface TouchCard {
  id: string;
  label: string;
  labelEn: string;
  category: 'severity' | 'symptom' | 'timing' | 'doc' | 'unit';
  icon: string;
}

export interface ReverseSignCard {
  keyword: string;
  meaningVi: string;
  meaningEn: string;
  actionGuideVi: string;
  actionGuideEn: string;
  iconName: string;
}

export interface Scenario {
  id: ScenarioId;
  titleVi: string;
  titleEn: string;
  badgeVi: string;
  badgeEn: string;
  descriptionVi: string;
  descriptionEn: string;
  steps: GestureStep[];
  touchCards: TouchCard[];
  baseSentenceVi: string;
  baseSentenceEn: string;
  doctorPresetVi: string;
  doctorPresetEn: string;
  expectedKeywords: string[];
}
