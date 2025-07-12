export const PHASE_UPDATE_EVENT = 'phaseUpdate';

export function dispatchPhaseUpdate() {
  window.dispatchEvent(new CustomEvent(PHASE_UPDATE_EVENT));
} 