// KESTREL wants a name and a password. Daisy can't see your room. You can.
export default {
  id: 'roomhunt',
  title: 'look around',
  window: false,
  mount(_body, ctx) {
    const needs = ctx.params.needs ?? [];
    const have = () => needs.every((c) => ctx.store.get(`flags.${c}`));
    if (have()) return Promise.resolve();
    ctx.world.look?.setEnabled(true);
    return new Promise((resolve) => {
      const offInspect = ctx.bus.on('hotspot:inspected', () => ctx.activity());
      const offState = ctx.bus.on('state:change', async ({ path }) => {
        if (!path.startsWith('flags.') || !have()) return;
        offState(); offInspect();
        await ctx.world.look?.exit();
        resolve();
      });
    });
  },
};
