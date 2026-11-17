// The catalog URL remains the img fallback and the source of product identity.
// Derive delivery sizes only for the documented, unsigned Pexels formats.
export function pexelsCropSrcSet(value: string, shape: 'square' | 'landscape' = 'square'): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'images.pexels.com' || url.username || url.password || url.hash ||
        !/^\/photos\/(\d+)\/pexels-photo-\1\.jpeg$/.test(url.pathname)) return undefined;
    const entries = [...url.searchParams];
    if (entries.length !== 4 || new Set(entries.map(([key])=>key)).size !== 4 ||
        entries.some(([key])=>!['auto','cs','w','h'].includes(key)) ||
        url.searchParams.get('auto') !== 'compress' || url.searchParams.get('cs') !== 'tinysrgb' ||
        !((url.searchParams.get('w') === '900' && url.searchParams.get('h') === '900') ||
          (url.searchParams.get('w') === '940' && url.searchParams.get('h') === '650'))) return undefined;
    const maxWidth=Number(url.searchParams.get('w'));
    return [160,320,640,maxWidth].map(width=>{
      const resized = new URL(url);
      resized.searchParams.set('w', String(width));
      resized.searchParams.set('h', String(shape === 'landscape' ? Math.round(width / 1.6) : width));
      resized.searchParams.set('fit', 'crop');
      return `${resized.href} ${width}w`;
    }).join(', ');
  } catch { return undefined; }
}
