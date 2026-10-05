// Original 16x16 pixel icons rendered as crisp SVG. '.' = transparent; other chars index the palette.
function pixelIcon(rows, palette) {
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`);
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const K = '#101010', G = '#c0c0c0', W = '#ffffff', D = '#808080', T = '#0a6e6e', P = '#9dffcf', Y = '#e8c84a', B = '#2b4fa8';
const R = '#c4502a', O = '#e08a2a', Gn = '#3d8f4a', Lb = '#7fb2e8';

export const ICONS = {
  voyager: pixelIcon([
    '................', '.....KKKKKK.....', '...KKBBBBBBKK...', '..KBBBBBWBBBBK..', '..KBBBBBWBBBBK..', '.KBBBBBWWWBBBBK.',
    '.KBBBBBWWWBBBBK.', '.KBBBYYYKYYYBBK.', '.KBBBBBYYYBBBBK.', '.KBBBBBYYYBBBBK.', '..KBBBBBYBBBBK..', '..KBBBBBYBBBBK..',
    '...KKBBBBBBKK...', '.....KKKKKK.....', '................', '................'], { K, B, W, Y }),
  recycle: pixelIcon([
    '................', '.....KKKKKK.....', '....KDDDDDDK....', '...KKKKKKKKKK...', '...KGGGGGGGGK...', '...KGDGDGDGGK...',
    '...KGDGDGDGGK...', '...KGDGDGDGGK...', '...KGDGDGDGGK...', '...KGDGDGDGGK...', '...KGGGGGGGGK...', '....KKKKKKKK....',
    '................', '................', '................', '................'], { K, D, G }),
  bsn: pixelIcon([
    '................', '....KKK..KKK....', '...KgggKKgggK...', '...KgggKKgggK...', '....KKK..KKK....', '...KlllK.KlllK..',
    '..KlllllKKlllllK', '..KlllllKKlllllK', '...KKKKK..KKKKK.', '................', '................', '................',
    '................', '................', '................', '................'], { K, g: Gn, l: Lb }),
  pictures: pixelIcon([
    '................', '................', '.KKKKK..........', '.KYYYYK.........', '.KYYYYYKKKKKKKK.', '.KYKKKKKKKKKKYK.',
    '.KYKWWWWWWWWKYK.', '.KYKWLWWWWWWKYK.', '.KYKWWWWGWWWKYK.', '.KYKWWWGGGWWKYK.', '.KYKKKKKKKKKKYK.', '.KKKKKKKKKKKKKK.',
    '................', '................', '................', '................'], { K, Y, W, L: Lb, G: Gn }),
  hellgate: pixelIcon([
    '................', '....KKKKKKKK....', '...KOOOOOOOOK...', '..KOOKKOOKKOOK..', '..KOKRRKKRRKOK..', '..KOOKKOOKKOOK..',
    '..KOOOOKKOOOOK..', '...KOOOOOOOOK...', '...KOKOKOKOKK...', '....KKKKKKKK....', '................', '................',
    '................', '................', '................', '................'], { K, O, R }),
  computer: pixelIcon([
    '................', '..KKKKKKKKKKKK..', '..KGGGGGGGGGGK..', '..KGTTTTTTTTGK..', '..KGTTTTTTTTGK..', '..KGTTWTTTTTGK..',
    '..KGTTTTTTTTGK..', '..KGTTTTTTTTGK..', '..KGGGGGGGGGGK..', '..KKKKKKKKKKKK..', '.......KK.......', '....KKKKKKKK....',
    '...KGGGGGGGGK...', '...KDDDDDDDDK...', '...KKKKKKKKKK...', '................'], { K, G, T, W, D }),
  terminal: pixelIcon([
    '................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.', '.KKKKKKKKKKKKKK.', '.KK.P........KK.', '.KK..P.......KK.',
    '.KK.P........KK.', '.KK....PPP...KK.', '.KK..........KK.', '.KK..........KK.', '.KKKKKKKKKKKKKK.', '................',
    '................', '................', '................', '................'], { K, G, P }),
  phone: pixelIcon([
    '................', '..KKK......KKK..', '.KDDDKKKKKKDDDK.', '.KDDDDDDDDDDDDK.', '.KKKKDDDDDDKKKK.', '....KDDDDDDK....',
    '...KDDKKKKDDK...', '..KDDK.KK.KDDK..', '..KDDDKKKKDDDK..', '..KDDDDDDDDDDK..', '..KKKKKKKKKKKK..', '................',
    '................', '................', '................', '................'], { K, D }),
  mail: pixelIcon([
    '................', '................', '.KKKKKKKKKKKKKK.', '.KWKWWWWWWWWKWK.', '.KWWKWWWWWWKWWK.', '.KWWWKWWWWKWWWK.',
    '.KWWWWKKKKWWWWK.', '.KWWWWWWWWWWWWK.', '.KWWWWWWWWWWWWK.', '.KKKKKKKKKKKKKK.', '................', '................',
    '................', '................', '................', '................'], { K, W }),
  folder: pixelIcon([
    '................', '................', '.KKKKK..........', '.KYYYYK.........', '.KYYYYYKKKKKKKK.', '.KYYYYYYYYYYYYK.',
    '.KYYYYYYYYYYYYK.', '.KYYYYYYYYYYYYK.', '.KYYYYYYYYYYYYK.', '.KYYYYYYYYYYYYK.', '.KKKKKKKKKKKKKK.', '................',
    '................', '................', '................', '................'], { K, Y }),
  eye: pixelIcon([
    '................', '................', '................', '.....KKKKKK.....', '...KKWWWWWWKK...', '..KWWWKKKKWWWK..',
    '.KWWWK.YY.KWWWK.', '.KWWWK.YY.KWWWK.', '..KWWWKKKKWWWK..', '...KKWWWWWWKK...', '.....KKKKKK.....', '................',
    '................', '................', '................', '................'], { K, W, Y }),
  calc: pixelIcon([
    '...KKKKKKKKKK...', '...KGGGGGGGGK...', '...KKKKKKKKKK...', '...KPPPPPPPPK...', '...KKKKKKKKKK...', '...KWKWKWKDDK...',
    '...KKKKKKKKKK...', '...KWKWKWKDDK...', '...KKKKKKKKKK...', '...KWKWKWKDDK...', '...KKKKKKKKKK...', '...KWWWKWKDDK...',
    '...KKKKKKKKKK...', '................', '................', '................'], { K, G, P, W, D }),
  gear: pixelIcon([
    '................', '.......KK.......', '...KK.KDDK.KK...', '...KDKDDDDKDK...', '....KDDDDDDK....', '..KKDDDKKDDDKK..',
    '..KDDDK..KDDDK..', '..KDDDK..KDDDK..', '..KKDDDKKDDDKK..', '....KDDDDDDK....', '...KDKDDDDKDK...', '...KK.KDDK.KK...',
    '.......KK.......', '................', '................', '................'], { K, D }),
  modem: pixelIcon([
    '................', '................', '................', '................', '..KKKKKKKKKKKK..', '.KDDDDDDDDDDDDK.',
    '.KDPDPDPDDDDDDK.', '.KDDDDDDDDDDDDK.', '.KKKKKKKKKKKKKK.', '................', '................', '................',
    '................', '................', '................', '................'], { K, D, P }),
  disk: pixelIcon([
    '..KKKKKKKKKKKK..', '..KBBKGGGGKBBK..', '..KBBKGGDGKBBK..', '..KBBKGGDGKBBK..', '..KBBKKKKKKBBK..', '..KBBBBBBBBBBK..',
    '..KBWWWWWWWWBK..', '..KBWDDDDDDWBK..', '..KBWWWWWWWWBK..', '..KBWDDDDDDWBK..', '..KBWWWWWWWWBK..', '..KKKKKKKKKKKK..',
    '................', '................', '................', '................'], { K, B, G, D, W }),
  winramp: pixelIcon([
    '................', '.KKKKKKKKKKKKKK.', '.KDDDDDDDDDDDDK.', '.KDDDDDYYKDDDDK.', '.KDDDDYYKDDDDDK.', '.KDDDYYKDDDDDDK.',
    '.KDDYYYYYYKDDDK.', '.KDDDDDYYKDDDDK.', '.KDDDDYYKDDDDDK.', '.KDDDYYKDDDDDDK.', '.KDDYYKDDDDDDDK.', '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.', '................', '................', '................'], { K, D, Y }),
  error: pixelIcon([
    '.....KKKKKK.....', '...KKRRRRRRKK...', '..KRRRRRRRRRRK..', '.KRRWWRRRRWWRRK.', '.KRRRWWRRWWRRRK.', 'KRRRRRWWWWRRRRRK',
    'KRRRRRRWWRRRRRRK', 'KRRRRRWWWWRRRRRK', '.KRRRWWRRWWRRRK.', '.KRRWWRRRRWWRRK.', '..KRRRRRRRRRRK..', '...KKRRRRRRKK...',
    '.....KKKKKK.....', '................', '................', '................'], { K, R, W }),
  hdd: pixelIcon([
    '................', '................', '................', '................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.',
    '.KGWWWWWWWWWWGK.', '.KGGGGGGGGGGGGK.', '.KDDDDDDDDDDDDK.', '.KDDDDDDDDDNNDK.', '.KKKKKKKKKKKKKK.', '................',
    '................', '................', '................', '................'], { K, G, W, D, N: Gn }),
  cdrom: pixelIcon([
    '................', '................', '................', '................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.',
    '.KGKKKKKKKKKKGK.', '.KGGGGGGGGGGGGK.', '.KGGGGGGGGGDDGK.', '.KKKKKKKKKKKKKK.', '................', '................',
    '................', '................', '................', '................'], { K, G, D }),
  printer: pixelIcon([
    '................', '....KKKKKKKK....', '....KWWWWWWK....', '....KWDDDDWK....', '..KKKKKKKKKKKK..', '.KGGGGGGGGGGGGK.',
    '.KGGGGGGGGGNGGK.', '.KGGGGGGGGGGGGK.', '.KKKKKKKKKKKKKK.', '...KWWWWWWWWK...', '...KWDDDDDDWK...', '...KKKKKKKKKK...',
    '................', '................', '................', '................'], { K, W, D, G, N: Gn }),
  program: pixelIcon([
    '................', '.KKKKKKKKKKKKKK.', '.KBBBBBBBBBBBBK.', '.KKKKKKKKKKKKKK.', '.KWWWWWWWWWWWWK.', '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.', '.KWWWWWWWWWWWWK.', '.KWWWWWWWWWWWWK.', '.KKKKKKKKKKKKKK.', '................', '................',
    '................', '................', '................', '................'], { K, B, W }),
  unknown: pixelIcon([ // install.exe: a file nobody recognises
    '..KKKKKKKKK.....', '..KWWWWWWWKK....', '..KWWWWWWWKWK...', '..KWWWBBBWKKKK..', '..KWWBWWWBWWWK..', '..KWWWWWWBWWWK..',
    '..KWWWWWBWWWWK..', '..KWWWWBWWWWWK..', '..KWWWWBWWWWWK..', '..KWWWWWWWWWWK..', '..KWWWWBWWWWWK..', '..KWWWWWWWWWWK..',
    '..KWWWWWWWWWWK..', '..KKKKKKKKKKKK..', '................', '................'], { K, W, B }),
  text: pixelIcon([
    '..KKKKKKKKK.....', '..KWWWWWWWKK....', '..KWWWWWWWKWK...', '..KWDDDDWWKKKK..', '..KWWWWWWWWWWK..', '..KWDDDDDDDWWK..',
    '..KWWWWWWWWWWK..', '..KWDDDDDDDWWK..', '..KWWWWWWWWWWK..', '..KWDDDDDWWWWK..', '..KWWWWWWWWWWK..', '..KWDDDDDDDWWK..',
    '..KWWWWWWWWWWK..', '..KKKKKKKKKKKK..', '................', '................'], { K, W, D }),
  inlook: pixelIcon([ // Inlook: an envelope with the blue info badge
    '................', '.KKKKKKKKKKKKK..', '.KDWWWWWWWWWDK..', '.KWDWWWWWWWDWK..', '.KWWDWWWWWDWWK..', '.KWWWDWWWDWWWK..',
    '.KWWWWDDDWWWWK..', '.KWWWWWWWWBBBB..', '.KWWWWWWWBBBWBB.', '.KKKKKKKKBBBBBB.', '.........BBBWBB.', '.........BBBWBB.',
    '.........BBBWBB.', '..........BBBB..', '................', '................'], { K, W, D, B }),
};

// Everything on the desk before the blackout. Only install.exe survives the reboot; DSN and Voyager come back later.
export const PROLOGUE_APPS = [
  { id: 'mycomp', title: 'My Computer', icon: ICONS.computer },
  { id: 'recycle', title: 'Recycle Bin', icon: ICONS.recycle },
  { id: 'bsn', title: 'DSN Messenger', icon: ICONS.bsn },
  { id: 'pictures', title: 'Pictures', icon: ICONS.pictures },
  { id: 'hellgate', title: 'HELLGATE.EXE', icon: ICONS.hellgate },
  { id: 'winramp', title: 'DoorRAMP', icon: ICONS.winramp },
  { id: 'voyager', title: 'Internet Voyager', icon: ICONS.voyager },
  { id: 'inlook', title: 'Inlook', icon: ICONS.inlook },
];
