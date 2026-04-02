/**
 * Extract dominant colors from an image URL using Canvas.
 * Returns [brandColor, accentColor] as hex strings.
 */
export async function extractColorsFromImage(
  imageUrl: string
): Promise<{ brand: string; accent: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Collect all pixels as [r, g, b]
        const pixels: [number, number, number][] = [];
        for (let i = 0; i < data.length; i += 4) {
          pixels.push([data[i], data[i + 1], data[i + 2]]);
        }

        // Filter out near-white (>220 all channels) and near-black (<20 all channels)
        const filtered = pixels.filter(
          ([r, g, b]) =>
            !(r > 220 && g > 220 && b > 220) &&
            !(r < 20 && g < 20 && b < 20)
        );

        if (filtered.length < 10) return resolve(null);

        // Simple k-means with k=5
        const clusters = kMeans(filtered, 5);

        // Sort by cluster size (most pixels first)
        clusters.sort((a, b) => b.count - a.count);

        // Pick brand = largest cluster, accent = most saturated of remaining
        const brand = clusters[0];
        const accent =
          clusters.slice(1).sort((a, b) => saturation(b.center) - saturation(a.center))[0] ||
          clusters[1];

        if (!brand || !accent) return resolve(null);

        // Ensure brand and accent are visually distinct
        const brandHex = rgbToHex(brand.center);
        let accentHex = rgbToHex(accent.center);

        // If too similar, try next cluster
        if (colorDistance(brand.center, accent.center) < 50 && clusters.length > 2) {
          const alt = clusters.find(
            (c, i) => i > 0 && colorDistance(brand.center, c.center) >= 50
          );
          if (alt) accentHex = rgbToHex(alt.center);
        }

        resolve({ brand: brandHex, accent: accentHex });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

function kMeans(
  pixels: [number, number, number][],
  k: number
): { center: [number, number, number]; count: number }[] {
  // Initialize centroids by sampling evenly
  const step = Math.floor(pixels.length / k);
  let centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  for (let iter = 0; iter < 10; iter++) {
    const assignments: number[][] = Array.from({ length: k }, () => []);

    // Assign pixels to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let j = 0; j < k; j++) {
        const d = colorDistance(pixels[i], centroids[j]);
        if (d < minDist) {
          minDist = d;
          minIdx = j;
        }
      }
      assignments[minIdx].push(i);
    }

    // Update centroids
    for (let j = 0; j < k; j++) {
      if (assignments[j].length === 0) continue;
      const sum: [number, number, number] = [0, 0, 0];
      for (const idx of assignments[j]) {
        sum[0] += pixels[idx][0];
        sum[1] += pixels[idx][1];
        sum[2] += pixels[idx][2];
      }
      centroids[j] = [
        Math.round(sum[0] / assignments[j].length),
        Math.round(sum[1] / assignments[j].length),
        Math.round(sum[2] / assignments[j].length),
      ];
    }
  }

  // Count pixels per cluster
  const counts: number[] = Array(k).fill(0);
  for (const p of pixels) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let j = 0; j < k; j++) {
      const d = colorDistance(p, centroids[j]);
      if (d < minDist) {
        minDist = d;
        minIdx = j;
      }
    }
    counts[minIdx]++;
  }

  return centroids.map((c, i) => ({ center: c, count: counts[i] }));
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
