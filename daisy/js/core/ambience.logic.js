// The city under the window: what passes, how often, how loud, from where. Pure; cutscene.js schedules it.
export const CITY_EVENTS = [
  { name: 'siren_police', weight: 3, gain: [0.06, 0.14] },
  { name: 'siren_ambulance', weight: 3, gain: [0.06, 0.14] },
  { name: 'siren_far', weight: 2, gain: [0.05, 0.1] },
  { name: 'horn_far', weight: 1, gain: [0.06, 0.12] },
];

export function nextCityEvent(rand = Math.random, events = CITY_EVENTS) {
  const total = events.reduce((s, e) => s + e.weight, 0);
  let r = rand() * total;
  let pick = events[0];
  for (const e of events) {
    if (r < e.weight) { pick = e; break; }
    r -= e.weight;
  }
  const [lo, hi] = pick.gain;
  return { name: pick.name, delay: 4 + rand() * 10, gain: lo + rand() * (hi - lo), pan: 0.2 + rand() * 0.7, rate: 0.9 + rand() * 0.2 };
}
