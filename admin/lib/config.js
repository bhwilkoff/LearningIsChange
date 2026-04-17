// Site-agnostic config for admin tools.
// The subdomain repos (bothand/getwhale/whitfordwest.family/masculinitydetox.org)
// should be able to adopt admin/lib/ unchanged by only editing this file.

export const CONFIG = {
  repo: {
    owner: 'bhwilkoff',
    name: 'LearningIsChange',
    branch: 'main',
  },
  site: {
    hostname: 'learningischange.com',
    base: 'https://learningischange.com',
  },
  cdn: {
    // Jetpack Photon mirrors — serve resized images on the fly from
    // the canonical URL at site.base. Verified working for this domain
    // without the Jetpack plugin being active.
    photon: ['https://i0.wp.com', 'https://i1.wp.com', 'https://i2.wp.com'],
  },
  paths: {
    uploads: 'wp-content/uploads',
    database: 'database',
    feeds: 'feed',
  },
};

export function photonUrl(relPath, { width, height, fit } = {}) {
  const base = `${CONFIG.cdn.photon[0]}/${CONFIG.site.hostname}/${relPath}`;
  const params = new URLSearchParams({ ssl: '1' });
  if (fit) params.set('fit', fit);
  else if (width && height) params.set('fit', `${width},${height}`);
  else if (width) params.set('w', String(width));
  return `${base}?${params.toString()}`;
}
