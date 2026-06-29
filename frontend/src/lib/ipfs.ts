export interface IpfsUploadResult {
  cid: string;
  url: string;
}

export async function uploadToIpfs(file: File): Promise<IpfsUploadResult | null> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) {
    console.warn('[IPFS] No NEXT_PUBLIC_PINATA_JWT set — file upload unavailable');
    return null;
  }

  const form = new FormData();
  form.append('file', file);

  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Pinata: ${res.status}`);
    const json = await res.json();
    return { cid: json.IpfsHash, url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}` };
  } catch (err) {
    console.error('[IPFS] upload failed:', err);
    return null;
  }
}

export function getIpfsUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export const FILE_MARKER = '[f:';

export function encodeFileMessage(cid: string): string {
  return `${FILE_MARKER}${cid}]`;
}

export function parseFileMessage(content: string): { cid: string } | null {
  const m = content.match(/\[f:([a-zA-Z0-9]+)\]/);
  if (!m) return null;
  return { cid: m[1] };
}
