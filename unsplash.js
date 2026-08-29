'use strict';

const https = require('https');

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'Authorization': `Client-ID ${ACCESS_KEY}`,
          'Accept-Version': 'v1',
          'User-Agent': 'AI-Presentation-Bot/1.0',
        },
      },
      (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`Unsplash API ${res.statusCode}: ${data.slice(0, 200)}`)
            );
          }

          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Unsplash JSON parse failed'));
          }
        });
      }
    ).on('error', reject);
  });
}

async function searchUnsplash(query, count = 1) {
  if (!ACCESS_KEY) {
    throw new Error('UNSPLASH_ACCESS_KEY жоқ');
  }

  const params = new URLSearchParams({
    query: String(query || '').trim(),
    per_page: String(Math.min(Math.max(count, 1), 30)),
    orientation: 'landscape',
    content_filter: 'high',
  });

  const url = `https://api.unsplash.com/search/photos?${params}`;

  const data = await requestJson(url);

  return (data.results || []).map(photo => ({
    id: photo.id,
    url: photo.urls?.regular || photo.urls?.full || photo.urls?.raw,
    thumb: photo.urls?.small || photo.urls?.thumb,
    width: photo.width,
    height: photo.height,
    alt: photo.alt_description || photo.description || '',
    photographer: photo.user?.name || '',
    source: 'unsplash',
  })).filter(photo => photo.url);
}

async function getImagesForRequirements(imageRequirements = []) {
  const results = [];

  for (const requirement of imageRequirements) {
    if (requirement.isChartZone || !requirement.queryIntent) {
      results.push({
        ...requirement,
        image: null,
      });
      continue;
    }

    try {
      const photos = await searchUnsplash(
        requirement.queryIntent,
        5
      );

      /*
       * Image search is slide-driven, not zone-driven.
       * The layout/zone only controls placement and cropping.
       *
       * For now choose the first valid Unsplash result.
       * We request 5 candidates so a later quality selector
       * can choose among them without changing the API layer.
       */
      const image = photos.find(photo =>
        photo &&
        photo.url &&
        Number(photo.width) > 0 &&
        Number(photo.height) > 0
      ) || null;

      results.push({
        ...requirement,
        image,
      });
    } catch (err) {
      console.error(
        `[unsplash] ${requirement.zone || 'image'}: ${err.message}`
      );

      results.push({
        ...requirement,
        image: null,
      });
    }
  }

  return results;
}

module.exports = {
  searchUnsplash,
  getImagesForRequirements,
};
