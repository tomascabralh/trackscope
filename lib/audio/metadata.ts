import { parseBlob } from "music-metadata";
import type { TrackMetadata } from "./types";

export async function parseTrackMetadata(file: File): Promise<TrackMetadata> {
  const base: TrackMetadata = {
    fileName: file.name,
    fileSizeBytes: file.size,
  };

  try {
    const meta = await parseBlob(file);
    const { common, format } = meta;
    const picture = common.picture?.[0];

    return {
      ...base,
      title: common.title,
      artist: common.artist ?? common.albumartist,
      album: common.album,
      year: common.year,
      genre: common.genre?.[0],
      trackNumber: common.track?.no ?? undefined,
      bitrateKbps: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
      codec: format.codec,
      container: format.container,
      coverDataUrl: picture ? pictureToDataUrl(picture) : undefined,
    };
  } catch {
    return base;
  }
}

function pictureToDataUrl(picture: {
  format: string;
  data: Uint8Array;
}): string | undefined {
  try {
    let binary = "";
    const data = picture.data;
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    const b64 = btoa(binary);
    return `data:${picture.format};base64,${b64}`;
  } catch {
    return undefined;
  }
}
