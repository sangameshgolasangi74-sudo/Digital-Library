import heroLibraryImg from '../assets/images/hero_library_exchange_1794743405492.jpg';
import coverAlgorithmsImg from '../assets/images/cover_algorithms_systems_1794743405726.jpg';
import coverLiteratureImg from '../assets/images/cover_classic_literature_1794743405943.jpg';
import coverArchitectureImg from '../assets/images/cover_architecture_design_1794743406115.jpg';
import coverScienceImg from '../assets/images/cover_environmental_science_1794743406472.jpg';
import coverHistoryImg from '../assets/images/cover_world_history_1794743407118.jpg';
import coverElectronicsImg from '../assets/images/cover_electronics_vlsi_1794744190222.jpg';
import coverMechanicalImg from '../assets/images/cover_mechanical_thermo_1794744190412.jpg';

export const HERO_LIBRARY_IMAGE = heroLibraryImg;

export const COVER_PRESETS: Record<string, string> = {
  cover_algorithms: coverAlgorithmsImg,
  cover_literature: coverLiteratureImg,
  cover_architecture: coverArchitectureImg,
  cover_science: coverScienceImg,
  cover_history: coverHistoryImg,
  cover_electronics: coverElectronicsImg,
  cover_mechanical: coverMechanicalImg
};

export const COVER_PRESET_OPTIONS = [
  { key: 'cover_electronics', label: 'Electronics & Circuit Engineering' },
  { key: 'cover_mechanical', label: 'Mechanical & Thermodynamics' },
  { key: 'cover_algorithms', label: 'Navy Technical & CS Edition' },
  { key: 'cover_architecture', label: 'Structural & Architectural Grid' },
  { key: 'cover_science', label: 'Botanical & Earth Science' },
  { key: 'cover_literature', label: 'Slate Clothbound Novel' },
  { key: 'cover_history', label: 'Archival History Volume' }
];

export function resolveCoverUrl(coverKeyOrUrl?: string): string {
  if (!coverKeyOrUrl) return coverLiteratureImg;
  if (COVER_PRESETS[coverKeyOrUrl]) return COVER_PRESETS[coverKeyOrUrl];
  if (coverKeyOrUrl.startsWith('data:image/') || coverKeyOrUrl.startsWith('/') || coverKeyOrUrl.startsWith('http')) {
    return coverKeyOrUrl;
  }
  return coverLiteratureImg;
}
