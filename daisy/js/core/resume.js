// What the desktop should look like when a save resumes. Beat 0 is the cold open, which builds the desktop itself. Pure.
export function resumeView(state) {
  const f = state?.flags ?? {};
  const prologue = !f.blackout;
  return {
    prologue,
    daisyIcon: !prologue,
    bsn: prologue || f.bsnBack === true,
    deskReady: state?.beat > 0,
    chatOpen: f.daisyAwake === true,
    music: prologue ? 'winramp' : (f.daisyAwake ? 'act1_bed' : null),
  };
}
