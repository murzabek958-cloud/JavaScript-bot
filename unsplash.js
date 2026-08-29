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

      // Score each candidate and pick the best match for the zone.
      console.log(
        `[unsplash-debug] zone=${requirement.zone || 'image'} ` +
        `isBackground=${Boolean(requirement.isBackground)} ` +
        `query="${requirement.queryIntent}" photos=${photos.length}`
      );

      const candidates = photos.filter(p =>
        p && p.url && Number(p.width) > 0 && Number(p.height) > 0
      );

      console.log(
        `[unsplash-debug] zone=${requirement.zone || 'image'} ` +
        `candidates=${candidates.length}`
      );

      if (photos.length === 0) {
        console.log(
          `[unsplash-debug] NO RESULTS: zone=${requirement.zone || 'image'} ` +
          `query="${requirement.queryIntent}"`
        );
      }

      let image = null;

      if (candidates.length > 0) {
        const dim      = requirement.dimensions;
        const zoneRatio = (dim && dim.w > 0 && dim.h > 0)
          ? dim.w / dim.h
          : null;

        const scored = candidates.map(p => {
          const photoRatio = p.width / p.height;
          let score = 0;

          if (zoneRatio !== null) {
            // Ratio score scaled to 0–10
            const ratioScore = 10 / (1 + Math.abs(Math.log(photoRatio / zoneRatio)));
            score += ratioScore;

            // Orientation bonus
            const zLand = zoneRatio  > 1.1;
            const zPort = zoneRatio  < 0.9;
            const pLand = photoRatio > 1.1;
            const pPort = photoRatio < 0.9;
            if      (zLand && pLand)   score += 2;
            else if (zPort && pPort)   score += 2;
            else if (!zLand && !zPort && !pLand && !pPort) score += 2; // both square-ish
          }

          // Resolution bonus — capped at +1
          score += Math.min((p.width * p.height) / 1_000_000 / 5, 1);

          return { photo: p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        image = scored[0].photo;

        console.log(
          `[unsplash] ${requirement.zone}: selected ${image.id} ` +
          `score=${scored[0].score.toFixed(2)} (${image.width}x${image.height})`
        );
      }

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
