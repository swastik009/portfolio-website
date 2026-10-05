// New Year's Eve at the desk. Nothing here is a puzzle; the beat ends when the file he went looking for finishes downloading.
export default {
  id: 'prologue',
  title: '',
  window: false,
  quiet: true,
  mount(_body, ctx) {
    return new Promise((resolve) => {
      const off = ctx.bus.on('download:done', ({ file }) => {
        if (file !== ctx.params.file) return;
        off();
        resolve();
      });
    });
  },
};
