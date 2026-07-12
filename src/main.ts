import './styles.css';
import { PosterStudio } from './poster-studio';

const studio = new PosterStudio();
studio.init();

window.addEventListener('pagehide', () => studio.destroy(), { once: true });
