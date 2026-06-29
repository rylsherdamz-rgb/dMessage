export interface IpfsUploadResult {
  cid: string;
  url: string;
}

export interface MessagePayload {
  t?: string;
  f?: string;
  n?: string;
}

async function pinataUpload(blob: Blob, filename: string): Promise<IpfsUploadResult | null> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) {
    console.warn('[IPFS] No NEXT_PUBLIC_PINATA_JWT set');
    return null;
  }
  const form = new FormData();
  form.append('file', blob, filename);
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

export async function uploadToIpfs(file: File): Promise<IpfsUploadResult | null> {
  return pinataUpload(file, file.name);
}

export async function uploadPayload(payload: MessagePayload): Promise<IpfsUploadResult | null> {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  return pinataUpload(blob, 'msg.json');
}

export async function fetchPayload(cid: string): Promise<MessagePayload | null> {
  try {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!res.ok) throw new Error(`gateway: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[IPFS] fetch failed:', err);
    return null;
  }
}

export function getIpfsUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
